// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getFakeDb } from './route-test-db'

vi.mock('drizzle-orm', async (original) => {
  const actual = await original<typeof import('drizzle-orm')>()
  const { drizzleOperatorsMock } = await import('./route-test-db')
  return { ...actual, ...drizzleOperatorsMock }
})
vi.mock('@/lib/drizzle/client', () => ({ getDb: () => getFakeDb().db }))
vi.mock('@/lib/api-helpers', () => ({
  getAuthedUser: async () => ({ id: 'owner' }),
  decryptEvent: (event: unknown) => event,
}))
vi.mock('@/lib/mcp/settings-tools', () => ({
  getSettings: async () => ({ timezone: 'Asia/Shanghai' }),
}))
vi.mock('@/lib/mcp/category-tools', () => ({ listCategories: async () => [] }))
vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: async () => ({ allowed: true }),
}))
vi.mock('ai', () => ({ generateObject: vi.fn() }))
import { generateObject } from 'ai'
import { POST } from '@/app/api/agent/search/route'

const fake = getFakeDb()
function seed(id: string, title: string, date = '2026-05-02', extra = {}) {
  fake.seed({
    id,
    title,
    userId: 'owner',
    description: null,
    location: null,
    startDate: new Date(`${date}T08:00:00Z`),
    endDate: new Date(`${date}T09:00:00Z`),
    isAllDay: false,
    rrule: null,
    seriesId: null,
    recurrenceId: null,
    ...extra,
  })
}
const empty = {
  preset: null,
  start: null,
  end: null,
  browse: null,
  names: null,
  categories: null,
  concepts: null,
  order: null,
}
async function search(text: string, plan: object) {
  vi.mocked(generateObject).mockResolvedValueOnce({
    object: { ...empty, ...plan },
  } as never)
  const response = await POST(
    new NextRequest('http://localhost/api/agent/search', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  )
  expect(response.status).toBe(200)
  return response.json()
}
beforeEach(() => {
  fake.reset()
  vi.clearAllMocks()
  vi.stubEnv('GROQ_API_KEY', 'test-key')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-03T00:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('semantic search quality through route, toolkit and real retrieval', () => {
  it('上次去东京旅游: keeps both destination and activity, including English titles', async () => {
    seed('trip', 'Trip to Tokyo', '2026-03-01')
    seed('hike', 'Weekend hiking trip')
    seed('office', '东京办公室会议')
    seed('private', 'Trip to Tokyo', '2026-04-01', { userId: 'someone-else' })
    const body = await search('上次去东京旅游的日程', {
      preset: 'past',
      order: 'latest',
      concepts: [
        ['东京', 'Tokyo'],
        ['旅游', '旅行', 'trip', 'travel', '之旅'],
      ],
    })
    expect(body.results.map((e: { id: string }) => e.id)).toEqual(['trip'])
  })
  it('中文遛狗 finds English Walk the dog', async () => {
    seed('dog', 'Walk the dog', '2026-04-11')
    seed('cat', 'Feed the cat', '2026-04-11')
    const body = await search('找出所有遛狗的日程', {
      concepts: [['遛狗', 'walk the dog', 'dog walking', 'walk dog']],
    })
    expect(body.results.map((e: { id: string }) => e.id)).toEqual(['dog'])
  })
  it('中文牙医 finds English Dentist appointment', async () => {
    seed('dentist', 'Dentist appointment', '2026-11-11')
    seed('lunch', 'Lunch with Sam', '2026-11-11')
    const body = await search('下次牙医', {
      concepts: [['牙医', 'dentist', 'dental appointment']],
      order: 'next',
    })
    expect(body.results.map((e: { id: string }) => e.id)).toEqual(['dentist'])
  })
  it('公司今年第二季度报告: keeps report AND company AND the quarter', async () => {
    seed('report', '公司季度报告')
    seed('meeting', '公司例会')
    seed('outside', '公司季度报告', '2026-08-01')
    const body = await search('公司今年第二季度报告', {
      start: '2026-04-01T00:00:00+08:00',
      end: '2026-07-01T00:00:00+08:00',
      order: 'relevance',
      concepts: [
        ['公司', 'company'],
        ['报告', 'report'],
      ],
    })
    expect(body.results.map((e: { id: string }) => e.id)).toEqual(['report'])
  })
  it('an empty exact search never relaxes its words, people or dates', async () => {
    seed('wrong-date', '东京旅行', '2026-08-01', {
      participants: [{ name: 'Alex' }],
    })
    seed('wrong-person', '东京旅行', '2026-05-01', {
      participants: [{ name: 'Bob' }],
    })
    seed('wrong-city', '大阪旅行', '2026-05-01', {
      participants: [{ name: 'Alex' }],
    })
    const body = await search('五月和Alex去东京旅行', {
      concepts: [['东京'], ['旅行']],
      names: ['Alex'],
      start: '2026-05-01T00:00:00+08:00',
      end: '2026-06-01T00:00:00+08:00',
    })
    expect(body.results).toEqual([])
    expect(body.query.names).toEqual(['Alex'])
  })
  it('scores all candidates before pagination and reuses the exact plan without AI', async () => {
    for (let i = 0; i < 55; i++)
      seed(`low-${String(i).padStart(2, '0')}`, 'Team sync', '2026-05-01', {
        description: 'company report',
      })
    seed('best', 'Company report', '2025-01-01')
    const first = await search('company report', {
      concepts: [['company'], ['report']],
    })
    expect(first.total).toBe(56)
    expect(first.results[0].id).toBe('best')
    expect(first.results).toHaveLength(50)
    // Even without a model key, paging is a database-only operation.
    vi.stubEnv('GROQ_API_KEY', '')
    const response = await POST(
      new NextRequest('http://localhost/api/agent/search', {
        method: 'POST',
        body: JSON.stringify({ page: 2, resolved: first.query }),
      }),
    )
    expect(response.status).toBe(200)
    const second = await response.json()
    expect(second.results).toHaveLength(6)
    expect(
      new Set([...first.results, ...second.results].map((e) => e.id)).size,
    ).toBe(56)
    expect(second.query).toEqual(first.query)
    expect(generateObject).toHaveBeenCalledTimes(1)
  })
  it('next chooses the nearest future result and latest chooses the nearest past', async () => {
    seed('old', 'Tokyo trip', '2025-01-01')
    seed('last', 'Tokyo trip', '2026-08-01')
    seed('next', 'Tokyo trip', '2026-10-04')
    seed('distant', 'Tokyo trip', '2027-01-01')
    const concepts = [['Tokyo'], ['trip']]
    const latest = await search('last Tokyo trip', {
      concepts,
      order: 'latest',
    })
    expect(latest.results.map((e: { id: string }) => e.id)).toEqual([
      'last',
      'old',
    ])
    const next = await search('next Tokyo trip', { concepts, order: 'next' })
    expect(next.results.map((e: { id: string }) => e.id)).toEqual([
      'next',
      'distant',
    ])
  })
  it('rejects an old or malformed paging plan without executing a new model search', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/agent/search', {
        method: 'POST',
        body: JSON.stringify({ page: 2, resolved: { query: 'trip' } }),
      }),
    )
    expect(response.status).toBe(400)
    expect(generateObject).not.toHaveBeenCalled()
  })
  it('keeps recurring series discoverable without inventing a date window', async () => {
    seed('series', 'Tokyo trip', '2025-01-01', {
      rrule: 'FREQ=MONTHLY;COUNT=4',
    })
    const body = await search('Tokyo trip', { concepts: [['Tokyo'], ['trip']] })
    expect(body.results.map((e: { id: string }) => e.id)).toEqual(['series'])
  })
})
