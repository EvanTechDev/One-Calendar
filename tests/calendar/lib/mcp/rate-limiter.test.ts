import { mock as moduleMock } from 'bun:test'
await import('./../../../support/dom')
import { describe, it, expect, vi, beforeEach } from 'bun:test'

/**
 * The MCP throttle's boundary.
 *
 * The count it reads is the audit rows already written, and the request being
 * admitted is not written until after the verdict. So a budget of N must admit
 * N requests and no more, which makes the comparison `count < maxRpm` rather
 * than `count <= maxRpm` — the inclusive form allows request N+1. Nothing
 * exercised that edge, which is why it shipped wrong.
 */
const mocks = (() => ({
  auditCount: 0,
  rateLimitRpm: 60,
}))()

moduleMock.module('@/lib/drizzle/client', () => ({
  getDb: () => ({
    // A thenable chain that ignores the query it is handed and answers with the
    // count the test wants. The point under test is the comparison, not the
    // SQL, and the SQL is a three-clause `and()` that a stub cannot check.
    select: () => ({
      from: () => ({
        where: () => ({
          then: (resolve: (rows: { count: number }[]) => unknown) =>
            Promise.resolve([{ count: mocks.auditCount }]).then(resolve),
        }),
      }),
    }),
  }),
}))

moduleMock.module('@/lib/mcp/settings', () => ({
  getMcpSettings: async () => ({ rateLimitRpm: mocks.rateLimitRpm }),
}))

const { checkRateLimit } = await import('@/lib/mcp/rate-limiter')

beforeEach(() => {
  mocks.auditCount = 0
  mocks.rateLimitRpm = 60
})

describe('checkRateLimit', () => {
  it('admits a request against an empty window', async () => {
    mocks.auditCount = 0
    const result = await checkRateLimit('user-1')

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(59)
  })

  it('admits the last request the budget has room for', async () => {
    // 59 rows already written means this is request 60 of 60.
    mocks.auditCount = 59
    const result = await checkRateLimit('user-1')

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('refuses the request after the budget is spent', async () => {
    // 60 rows already written means this would be request 61.
    mocks.auditCount = 60
    const result = await checkRateLimit('user-1')

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('reports a window boundary on the minute, in the future', async () => {
    const before = Date.now()
    const { resetAt } = await checkRateLimit('user-1')

    expect(resetAt % 60_000).toBe(0)
    expect(resetAt).toBeGreaterThan(before)
    expect(resetAt - before).toBeLessThanOrEqual(60_000)
  })

  it('honours a configured budget of one', async () => {
    // The clamp allows 1, and the boundary has to hold at the bottom too: the
    // first request is allowed, the second is not.
    mocks.rateLimitRpm = 1

    mocks.auditCount = 0
    expect((await checkRateLimit('user-1')).allowed).toBe(true)

    mocks.auditCount = 1
    expect((await checkRateLimit('user-1')).allowed).toBe(false)
  })
})
