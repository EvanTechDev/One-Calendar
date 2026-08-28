// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAuditLogs: vi.fn(async () => []),
  getAuditLogsCount: vi.fn(async () => 0),
  getAuditToolNames: vi.fn(async () => []),
}))

vi.mock('@/lib/mcp/audit', () => mocks)
vi.mock('@/lib/api-helpers', () => ({
  getAuthedUser: async () => ({ id: 'user-1', email: 'ada@example.com' }),
}))

const { GET } = await import('@/app/api/mcp/audit-logs/route')

function request(query: string): NextRequest {
  return new NextRequest(`https://calendar.test/api/mcp/audit-logs${query}`)
}

function lastFilters() {
  const call = mocks.getAuditLogs.mock.calls.at(-1) as unknown[]
  return call[3] as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/mcp/audit-logs filters', () => {
  it('passes no since/search when the params are absent', async () => {
    const res = await GET(request(''))
    expect(res.status).toBe(200)
    const filters = lastFilters()
    expect(filters.since).toBeUndefined()
    expect(filters.search).toBeUndefined()
  })

  it('maps window presets to a since timestamp', async () => {
    const before = Date.now()
    await GET(request('?window=24h'))
    const after = Date.now()
    const since = lastFilters().since as Date
    expect(since).toBeInstanceOf(Date)
    const expectedMs = 24 * 60 * 60 * 1000
    expect(since.getTime()).toBeGreaterThanOrEqual(before - expectedMs)
    expect(since.getTime()).toBeLessThanOrEqual(after - expectedMs)
  })

  it('ignores unknown window values', async () => {
    await GET(request('?window=90d'))
    expect(lastFilters().since).toBeUndefined()
  })

  it('trims and caps the search term', async () => {
    await GET(request(`?search=${encodeURIComponent('  create_event  ')}`))
    expect(lastFilters().search).toBe('create_event')

    await GET(request(`?search=${'x'.repeat(200)}`))
    expect((lastFilters().search as string).length).toBe(100)
  })

  it('drops a blank search term', async () => {
    await GET(request('?search=%20%20'))
    expect(lastFilters().search).toBeUndefined()
  })

  it('still forwards the existing filters', async () => {
    await GET(
      request('?entryType=tool_call&mutationsOnly=true&toolName=create_event'),
    )
    const filters = lastFilters()
    expect(filters.entryType).toBe('tool_call')
    expect(filters.mutationsOnly).toBe(true)
    expect(filters.toolName).toBe('create_event')
  })
})
