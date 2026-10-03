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
  concepts: [['旅游']],
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
// This fake verifies transport/coverage, not whether a real model understands a query.
function model(accepted: string[], query = plan) {
  const seen: Record<string, unknown>[] = []
  vi.mocked(generateObject).mockImplementation(async (options: any) => {
    if (options.schema === searchQuerySchema) return { object: query } as never
    const batch = JSON.parse(options.prompt)
    seen.push(...batch)
    return {
      object: {
        judgments: batch.map((e: { id: string }) => ({
          id: e.id,
          relevant: accepted.includes(e.id),
          score: accepted.includes(e.id) ? 90 : 0,
          evidence: accepted.includes(e.id) ? 'Fixture evidence' : 'Unrelated',
        })),
      },
    } as never
  })
  return seen
}
beforeEach(() => {
  fake.reset()
  vi.resetAllMocks()
  auth.id = 'owner'
  vi.stubEnv('GROQ_API_KEY', 'test-key')
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-03T00:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('search route: complete candidate scan and persisted AI decisions', () => {
  it('sends zero-overlap candidates and every field to AI, including after 200 rows', async () => {
    for (let i = 0; i < 205; i++) seed(`a-${i}`, 'Unrelated')
    seed('flight', 'Flight to Tokyo', { categoryId: 'travel' })
    seed('transfer', 'Go to Airport in Shanghai', {
      description: 'Transfer before flight to Tokyo',
      location: 'PVG',
      participants: [{ name: 'Alex' }],
    })
    seed('private', 'Flight to Tokyo', { userId: 'other' })
    const seen = model(['flight', 'transfer'])
    const response = await post({ text: '查找上次去日本东京旅游' })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(seen).toHaveLength(207)
    expect(seen.find((e) => e.id === 'flight')?.category).toBe('Travel')
    expect(seen.find((e) => e.id === 'transfer')).toMatchObject({
      location: 'PVG',
      description: 'Transfer before flight to Tokyo',
      participants: [{ name: 'Alex' }],
    })
    expect(body.results.map((e: any) => e.id)).toEqual(['flight', 'transfer'])
  })
  it('keeps user/time/category boundaries before AI and includes unbounded series', async () => {
    seed('series', 'Flight to Tokyo', { rrule: 'FREQ=MONTHLY;COUNT=4' })
    seed('outside', 'Trip', {
      startDate: new Date('2027-01-01'),
      endDate: new Date('2027-01-02'),
    })
    const seen = model(['series'], {
      ...plan,
      end: '2026-12-31T00:00:00Z',
    } as typeof plan)
    expect((await post({ text: '过去的旅行' })).status).toBe(200)
    expect(seen.some((e) => e.id === 'outside')).toBe(false)
    const unbounded = model(['series'])
    await post({ text: '所有旅行' })
    expect(unbounded.some((e) => e.id === 'series')).toBe(true)
  })
  it('freezes ranked decisions across pages without another AI call', async () => {
    const ids = Array.from({ length: 56 }, (_, i) => `event-${i}`)
    ids.forEach((id) => seed(id))
    model(ids)
    const first = await (await post({ text: '旅行' })).json()
    expect(first.results).toHaveLength(50)
    const calls = vi.mocked(generateObject).mock.calls.length
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
  it('keeps the original question in follow-up adjudication', async () => {
    seed('coffee', 'Cafe')
    model(['coffee'])
    const first = await (await post({ text: '找喝咖啡的日程' })).json()
    await post({ text: '只要上个月', previousToken: first.searchToken })
    const systems = vi
      .mocked(generateObject)
      .mock.calls.map(([o]: any) => o.system)
    expect(systems.at(-1)).toContain('找喝咖啡的日程')
    expect(systems.at(-1)).toContain('只要上个月')
  })
  it('rejects a missing batch instead of reporting an incomplete search as success', async () => {
    seed('flight', 'Flight to Tokyo')
    vi.mocked(generateObject)
      .mockResolvedValueOnce({ object: plan } as never)
      .mockResolvedValueOnce({ object: { judgments: [] } } as never)
    expect((await post({ text: '旅行' })).status).toBe(502)
  })
  it('returns empty when AI judges every event irrelevant', async () => {
    seed('noise', 'Unrelated')
    model([])
    expect((await (await post({ text: '旅行' })).json()).results).toEqual([])
  })
  it('still judges the original question when the compiler extracts no concepts', async () => {
    seed('dog', 'Walk the dog')
    seed('other', 'Feed the cat')
    model(['dog'], { ...plan, concepts: null })
    const response = await post({ text: '找出所有遛狗的日程' })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.query.concepts).toEqual([])
    expect(body.results.map((e: { id: string }) => e.id)).toEqual(['dog'])
  })
  it('rejects an unsealed legacy paging plan', async () => {
    expect((await post({ page: 2, resolved: { query: 'trip' } })).status).toBe(
      400,
    )
    expect(generateObject).not.toHaveBeenCalled()
  })
})
