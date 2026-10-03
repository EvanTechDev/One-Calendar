// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getFakeDb } from './route-test-db'
import { searchQuerySchema, type RawSearchQuery } from '@zntr/agent/search'

const auth = vi.hoisted(() => ({ id: 'owner' }))
vi.mock('drizzle-orm', async (original) => ({
  ...(await original<typeof import('drizzle-orm')>()),
  ...(await import('./route-test-db')).drizzleOperatorsMock,
}))
vi.mock('@/lib/drizzle/client', () => ({ getDb: () => getFakeDb().db }))
vi.mock('@/lib/api-helpers', () => ({
  getAuthedUser: async () => auth,
  decryptEvent: (e: unknown) => e,
}))
vi.mock('@/lib/mcp/settings-tools', () => ({
  getSettings: async () => ({ timezone: 'Asia/Shanghai' }),
}))
vi.mock('@/lib/mcp/category-tools', () => ({
  listCategories: async () => [{ id: 'travel', name: 'Travel' }],
}))
vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: async () => ({ allowed: true }),
}))
vi.mock('ai', () => ({ generateObject: vi.fn() }))
import { generateObject } from 'ai'
import { POST } from '@/app/api/agent/search/route'

const fake = getFakeDb()
function seed(id: string, title = id, extra = {}) {
  fake.seed({
    id,
    title,
    userId: 'owner',
    description: null,
    location: null,
    startDate: new Date('2026-04-12T08:00:00Z'),
    endDate: new Date('2026-04-12T09:00:00Z'),
    isAllDay: false,
    rrule: null,
    seriesId: null,
    recurrenceId: null,
    ...extra,
  })
}
const plan: RawSearchQuery = {
  concepts: [['旅游', 'travel', 'trip', 'flight', 'airport transfer']],
  preset: null,
  start: null,
  end: null,
  names: null,
  categories: null,
  order: null,
  browse: null,
}
function post(body: object) {
  return POST(
    new NextRequest('http://localhost/api/agent/search', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}
// Compiler fixture only: matching and pagination use the real application code.
function model(query = plan) {
  vi.mocked(generateObject)
    .mockResolvedValueOnce({ object: query } as never)
    .mockResolvedValue({ object: { concepts: query.concepts } } as never)
}
beforeEach(() => {
  fake.reset()
  vi.resetAllMocks()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  auth.id = 'owner'
  vi.stubEnv('GROQ_API_KEY', 'test-key')
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-03T00:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('search route: one compilation, complete local retrieval', () => {
  it('returns provider 429 without scheduling retries or hiding it as 502', async () => {
    vi.mocked(generateObject).mockRejectedValueOnce({
      statusCode: 429,
      responseHeaders: { 'retry-after': '42' },
      message: 'Provider quota exceeded',
    })
    const response = await post({ text: '旅行' })
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('42')
    expect(generateObject).toHaveBeenCalledTimes(1)
    expect(vi.mocked(generateObject).mock.calls[0][0].maxRetries).toBe(0)
  })
  it('logs arrival and early rejection without exposing the question', async () => {
    vi.stubEnv('GROQ_API_KEY', '')
    const response = await post({ text: 'private question' })
    expect(response.status).toBe(503)
    const requestId = response.headers.get('X-Search-Request-Id')
    expect(requestId).toBeTruthy()
    expect(console.info).toHaveBeenNthCalledWith(
      1,
      '[agent-search]',
      expect.objectContaining({ requestId, stage: 'received' }),
    )
    expect(console.info).toHaveBeenLastCalledWith(
      '[agent-search]',
      expect.objectContaining({ requestId, stage: 'finished', status: 503 }),
    )
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
      'private question',
    )
    expect(generateObject).not.toHaveBeenCalled()
  })
  it('finds matches after 200 rows with exactly one AI call and no event payloads', async () => {
    for (let i = 0; i < 205; i++) seed(`a-${i}`, 'Unrelated')
    seed('flight', 'Flight to Tokyo', { categoryId: 'travel' })
    seed('transfer', 'Go to Airport in Shanghai', {
      description: 'Transfer before flight to Tokyo',
      location: 'PVG',
      participants: [{ name: 'Alex' }],
    })
    seed('private', 'Flight to Tokyo', { userId: 'other' })
    model()
    const response = await post({ text: '查找上次去日本东京旅游' })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.results.map((e: any) => e.id)).toEqual(['flight', 'transfer'])
    expect(generateObject).toHaveBeenCalledTimes(1)
    const options = vi.mocked(generateObject).mock.calls[0][0]
    expect(options.schema).toBe(searchQuerySchema)
    expect(options.maxRetries).toBe(0)
    expect(options.prompt).toBe('查找上次去日本东京旅游')
    expect(JSON.stringify(options)).not.toContain(
      'Transfer before flight to Tokyo',
    )
    expect(console.info).toHaveBeenCalledWith(
      '[agent-search]',
      expect.objectContaining({
        stage: 'candidates-collected',
        candidates: 207,
      }),
    )
    expect(console.info).toHaveBeenLastCalledWith(
      '[agent-search]',
      expect.objectContaining({ stage: 'finished', status: 200 }),
    )
  })
  it('keeps time boundaries and includes unbounded series', async () => {
    seed('series', 'Flight to Tokyo', { rrule: 'FREQ=MONTHLY;COUNT=4' })
    seed('outside', 'Trip', {
      startDate: new Date('2027-01-01'),
      endDate: new Date('2027-01-02'),
    })
    model({
      ...plan,
      end: '2026-12-31T00:00:00Z',
    } as typeof plan)
    const bounded = await (await post({ text: '过去的旅行' })).json()
    expect(bounded.results.some((e: any) => e.id === 'outside')).toBe(false)
    model()
    const unbounded = await (await post({ text: '所有旅行' })).json()
    expect(unbounded.results.some((e: any) => e.id === 'series')).toBe(true)
  })
  it('freezes ranked decisions across pages without another AI call', async () => {
    const ids = Array.from({ length: 56 }, (_, i) => `event-${i}`)
    ids.forEach((id) => seed(id, 'Travel'))
    model()
    const first = await (await post({ text: '旅行' })).json()
    expect(first.results).toHaveLength(50)
    const calls = vi.mocked(generateObject).mock.calls.length
    expect(calls).toBe(1)
    vi.stubEnv('GROQ_API_KEY', '')
    const response = await post({ page: 2, searchToken: first.searchToken })
    expect(response.status).toBe(200)
    const second = await response.json()
    expect(second.results).toHaveLength(6)
    expect(
      new Set([...first.results, ...second.results].map((e) => e.id)).size,
    ).toBe(56)
    expect(generateObject).toHaveBeenCalledTimes(calls)
    const altered =
      (first.searchToken[0] === 'A' ? 'B' : 'A') + first.searchToken.slice(1)
    expect((await post({ page: 2, searchToken: altered })).status).toBe(400)
    auth.id = 'other'
    expect(
      (await post({ page: 2, searchToken: first.searchToken })).status,
    ).toBe(400)
    auth.id = 'owner'
    vi.setSystemTime(new Date('2026-10-03T00:16:00Z'))
    expect(
      (await post({ page: 2, searchToken: first.searchToken })).status,
    ).toBe(400)
  })
  it('keeps the complete previous query when compiling a follow-up', async () => {
    seed('coffee', 'Cafe')
    model({ ...plan, concepts: [['咖啡', 'coffee', 'cafe']] })
    const first = await (await post({ text: '找喝咖啡的日程' })).json()
    await post({ text: '只要上个月', previousToken: first.searchToken })
    const systems = vi
      .mocked(generateObject)
      .mock.calls.map(([o]: any) => o.system)
    expect(systems.at(-1)).toContain(JSON.stringify(first.query))
    expect(vi.mocked(generateObject).mock.calls.at(-1)?.[0].prompt).toBe(
      '只要上个月',
    )
    expect(generateObject).toHaveBeenCalledTimes(2)
  })
  it('checks revised expressions before returning empty, with a bounded AI budget', async () => {
    seed('noise', 'Unrelated')
    model()
    expect((await (await post({ text: '旅行' })).json()).results).toEqual([])
    expect(generateObject).toHaveBeenCalledTimes(2)
    expect(vi.mocked(generateObject).mock.calls[1][0].system).toContain(
      'No events matched',
    )
  })
  it('recovers old description/location matches beyond page one, then pages without AI', async () => {
    for (let i = 0; i < 205; i++) seed(`noise-${i}`, 'Unrelated')
    for (let i = 0; i < 56; i++)
      seed(`dog-${i}`, 'Morning routine', {
        startDate: new Date('2020-04-12T08:00:00Z'),
        endDate: new Date('2020-04-12T09:00:00Z'),
        ...(i % 2
          ? { description: 'Walk the dog' }
          : { location: 'Dog walking park' }),
      })
    seed('private-dog', 'Walk the dog', { userId: 'other' })
    model({ ...plan, concepts: [['遛狗']] })
    vi.mocked(generateObject).mockResolvedValue({
      object: { concepts: [['walk the dog', 'dog walking']] },
    } as never)
    const response = await post({ text: '找所有遛狗的日程' })
    expect(response.status).toBe(200)
    const first = await response.json()
    expect(first.total).toBe(56)
    expect(first.query.concepts).toEqual([
      ['遛狗', 'walk the dog', 'dog walking'],
    ])
    expect(first.query.start).toBeUndefined()
    expect(first.query.end).toBeUndefined()
    const repair = vi.mocked(generateObject).mock.calls[1][0]
    expect(repair.maxRetries).toBe(0)
    expect(repair.system).toContain('261')
    expect(JSON.stringify(repair)).not.toContain('Morning routine')
    const second = await (
      await post({ page: 2, searchToken: first.searchToken })
    ).json()
    expect(
      new Set([...first.results, ...second.results].map((e: any) => e.id)).size,
    ).toBe(56)
    expect(generateObject).toHaveBeenCalledTimes(2)
  })
  it('repairs words without escaping the original time, person or category constraints', async () => {
    fake.seed(
      { id: 'travel', userId: 'owner', name: 'Travel' },
      'calendar_categories',
    )
    const detail = {
      description: 'Airport transfer to Tokyo',
      categoryId: 'travel',
      participants: [{ name: 'Alex' }],
    }
    seed('wanted', 'Transfer', detail)
    seed('wrong-person', 'Transfer', {
      ...detail,
      participants: [{ name: 'Bob' }],
    })
    seed('wrong-category', 'Transfer', { ...detail, categoryId: 'work' })
    seed('outside', 'Transfer', {
      ...detail,
      startDate: new Date('2020-04-12'),
      endDate: new Date('2020-04-13'),
    })
    model({
      ...plan,
      concepts: [['东京'], ['旅游']],
      names: ['Alex'],
      categories: ['Travel'],
      preset: 'this_year',
    })
    vi.mocked(generateObject).mockResolvedValue({
      object: { concepts: [['Tokyo'], ['airport transfer']] },
    } as never)
    const result = await (
      await post({ text: '今年 Travel 分类里和 Alex 去东京旅游' })
    ).json()
    expect(result.results.map((e: any) => e.id)).toEqual(['wanted'])
    expect(result.query).toMatchObject({
      start: '2025-12-31T16:00:00.000Z',
      end: '2026-12-31T16:00:00.000Z',
      names: ['Alex'],
      categoryIds: ['travel'],
    })
  })
  it('does not repair words when no records exist within the hard constraints', async () => {
    model()
    expect((await (await post({ text: '旅行' })).json()).results).toEqual([])
    expect(generateObject).toHaveBeenCalledTimes(1)
  })
  it('propagates repair quota failures rather than declaring no matches', async () => {
    seed('dog', 'Walk the dog')
    vi.mocked(generateObject)
      .mockResolvedValueOnce({
        object: { ...plan, concepts: [['遛狗']] },
      } as never)
      .mockRejectedValueOnce({
        statusCode: 429,
        responseHeaders: { 'retry-after': '42' },
      })
    const response = await post({ text: '遛狗' })
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('42')
    expect(generateObject).toHaveBeenCalledTimes(2)
  })
  it('requires Tokyo and travel across fields, including category and description', async () => {
    seed('flight', 'Flight to Tokyo')
    seed('transfer', 'Go to Airport in Shanghai', {
      description: 'Transfer to PVG for the Tokyo holiday flight',
    })
    seed('category', 'Check in', { categoryId: 'travel', location: 'Tokyo' })
    seed('unknown', 'Go to Airport in Shanghai')
    seed('osaka', 'Flight to Osaka')
    seed('hike', 'Weekend hiking trip')
    model({
      ...plan,
      concepts: [
        ['东京', 'Tokyo'],
        ['旅游', 'travel', 'trip', 'flight', 'airport transfer'],
      ],
    })
    const body = await (await post({ text: '找东京旅游的日程' })).json()
    expect(body.results.map((event: any) => event.id).sort()).toEqual([
      'category',
      'flight',
      'transfer',
    ])
    expect(generateObject).toHaveBeenCalledTimes(1)
  })
  it('finds English dog walking and distinguishes drinking from coffee topics', async () => {
    seed('dog', 'Walk the dog')
    seed('cat', 'Feed the cat')
    seed('drink', 'Catch up with Sam', {
      description: 'Drink espresso together',
      location: 'Blue Bottle',
    })
    seed('repair', 'Coffee machine repair')
    model({ ...plan, concepts: [['遛狗', 'walk the dog', 'dog walking']] })
    expect(
      (await (await post({ text: '找所有遛狗的日程' })).json()).results.map(
        (e: any) => e.id,
      ),
    ).toEqual(['dog'])
    model({
      ...plan,
      concepts: [['喝咖啡', 'drink coffee', 'drink espresso', 'coffee with']],
    })
    expect(
      (await (await post({ text: '找喝咖啡的日程' })).json()).results.map(
        (e: any) => e.id,
      ),
    ).toEqual(['drink'])
    model({ ...plan, concepts: [['咖啡', 'coffee', 'espresso']] })
    expect(
      (await (await post({ text: '找咖啡相关日程' })).json()).results
        .map((e: any) => e.id)
        .sort(),
    ).toEqual(['drink', 'repair'])
    expect(generateObject).toHaveBeenCalledTimes(3)
  })
  it('keeps report AND company AND the explicit quarter', async () => {
    seed('report', 'Company report')
    seed('meeting', 'Company meeting')
    seed('outside', 'Company report', {
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-02'),
    })
    model({
      ...plan,
      concepts: [
        ['公司', 'company'],
        ['报告', 'report'],
      ],
      start: '2026-04-01T00:00:00+08:00',
      end: '2026-07-01T00:00:00+08:00',
    })
    expect(
      (await (await post({ text: '公司今年第二季度报告' })).json()).results.map(
        (e: any) => e.id,
      ),
    ).toEqual(['report'])
    expect(generateObject).toHaveBeenCalledTimes(1)
  })
  it('rejects an empty compiler output instead of listing the whole calendar', async () => {
    seed('dog', 'Walk the dog')
    seed('other', 'Feed the cat')
    model({ ...plan, concepts: null })
    const response = await post({ text: '找出所有遛狗的日程' })
    expect(response.status).toBe(502)
    expect(generateObject).toHaveBeenCalledTimes(1)
  })
  it('rejects an unsealed legacy paging plan', async () => {
    expect((await post({ page: 2, resolved: { query: 'trip' } })).status).toBe(
      400,
    )
    expect(generateObject).not.toHaveBeenCalled()
  })
})
