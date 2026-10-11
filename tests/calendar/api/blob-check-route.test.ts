// @vitest-environment node
/**
 * The daily maintenance entry point.
 *
 * It exists because four separate cron routes silently stopped running, so the
 * cases that matter here are the ones where a caller is told "ok" while
 * something was not actually pruned: a mistyped retention window, a retention
 * override that never reaches the job, and a subset that hides the job the
 * caller was trying to poke.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const audit = vi.hoisted(() => ({
  cleanupAuditLogs: vi.fn(async () => ({
    deleted: 0,
    retentionDays: 30,
    cutoff: '2026-09-01T00:00:00.000Z',
  })),
}))

vi.mock('@/lib/mcp/audit', () => audit)

const meetings = vi.hoisted(() => ({
  deleteExpiredMeetings: vi.fn(async () => []),
}))
vi.mock('@zntr/meetings', () => meetings)

const oauth = vi.hoisted(() => ({
  cleanupExpiredOAuthState: vi.fn(async () => ({ deleted: 0 })),
}))
vi.mock('@/lib/mcp/oauth-cleanup', () => oauth)

vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => ({ execute: () => Promise.resolve({ rows: [] }) }),
}))

import { GET } from '@/app/api/blob/check/route'

function request(query = '', token = 'correct-horse'): Request {
  return new Request(`http://localhost/api/blob/check${query}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

beforeEach(() => {
  audit.cleanupAuditLogs.mockReset()
  // Echoes the window it was handed, the way the real function reports it, so
  // these tests can tell "the override arrived" from "the job invented one".
  audit.cleanupAuditLogs.mockImplementation(async (days?: number) => ({
    deleted: 0,
    retentionDays: days ?? 30,
    cutoff: '2026-09-01T00:00:00.000Z',
  }))
  meetings.deleteExpiredMeetings.mockClear()
  oauth.cleanupExpiredOAuthState.mockClear()
  process.env.CRON_SECRET = 'correct-horse'
  delete process.env.MCP_AUDIT_RETENTION_DAYS
})

describe('GET /api/blob/check auth', () => {
  it('rejects everything when CRON_SECRET is unset', async () => {
    // Fail closed: an unset secret must not mean "no auth required", and must
    // not mean the jobs run unauthenticated either.
    delete process.env.CRON_SECRET
    const res = await GET(request())
    expect(res.status).toBe(500)
    expect(audit.cleanupAuditLogs).not.toHaveBeenCalled()
  })

  it('rejects a wrong token', async () => {
    expect((await GET(request('', 'wrong'))).status).toBe(401)
    expect(audit.cleanupAuditLogs).not.toHaveBeenCalled()
  })
})

describe('GET /api/blob/check jobs', () => {
  it('runs every job when no subset is asked for', async () => {
    const res = await GET(request())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(Object.keys(body.results).sort()).toEqual([
      'auditLogs',
      'expiredMeetings',
      'oauthState',
      'tables',
    ])
  })

  it('runs only the requested subset', async () => {
    const body = await (await GET(request('?jobs=auditLogs'))).json()
    expect(Object.keys(body.results)).toEqual(['auditLogs'])
    expect(meetings.deleteExpiredMeetings).not.toHaveBeenCalled()
  })

  it('rejects an unknown job name and names the ones that exist', async () => {
    const res = await GET(request('?jobs=auditLogs,auditlogs'))
    expect(res.status).toBe(400)
    expect((await res.json()).jobs).toContain('auditLogs')
    expect(audit.cleanupAuditLogs).not.toHaveBeenCalled()
  })

  it('still runs the rest when one job throws', async () => {
    // The blast radius this registry was built to prevent: one failing chore
    // must not read as "the whole run did nothing".
    oauth.cleanupExpiredOAuthState.mockRejectedValueOnce(new Error('boom'))
    const res = await GET(request())
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.results.oauthState.ok).toBe(false)
    expect(body.results.auditLogs.ok).toBe(true)
  })
})

describe('GET /api/blob/check retentionDays', () => {
  it('falls back to the environment when the param is absent', async () => {
    await GET(request('?jobs=auditLogs'))
    expect(audit.cleanupAuditLogs).toHaveBeenCalledWith(undefined)
  })

  it('passes the override through to the job', async () => {
    // The regression this guards: the option is declared on MaintenanceOptions
    // and consumed by the job, but nothing ever set it, so the window could
    // only be changed by a redeploy.
    await GET(request('?jobs=auditLogs&retentionDays=7'))
    expect(audit.cleanupAuditLogs).toHaveBeenCalledWith(7)
  })

  it('reads the window from the environment when there is no override', async () => {
    process.env.MCP_AUDIT_RETENTION_DAYS = '365'
    // The job's own default handles the environment, so the route must pass
    // undefined rather than resolve it here and lose the two-source ordering.
    await GET(request('?jobs=auditLogs'))
    expect(audit.cleanupAuditLogs).toHaveBeenCalledWith(undefined)
  })

  it.each(['', 'abc', '0', '-1', '7.5', '3651'])(
    'rejects %j instead of guessing a window',
    async (value) => {
      const res = await GET(
        request(`?jobs=auditLogs&retentionDays=${encodeURIComponent(value)}`),
      )
      expect(res.status).toBe(400)
      expect(audit.cleanupAuditLogs).not.toHaveBeenCalled()
    },
  )

  it('accepts both ends of the documented range', async () => {
    expect((await GET(request('?jobs=auditLogs&retentionDays=1'))).status).toBe(
      200,
    )
    expect(
      (await GET(request('?jobs=auditLogs&retentionDays=3650'))).status,
    ).toBe(200)
  })
})

describe('GET /api/blob/check reporting', () => {
  it('reports the window the job applied, not just a count', async () => {
    // The reason this field exists: `deleted: 0` alone cannot be told apart
    // from a job that had nothing to do, which is how a 365-day window hid
    // behind a clean zero for as long as it took to look.
    audit.cleanupAuditLogs.mockResolvedValue({
      deleted: 0,
      retentionDays: 365,
      cutoff: '2025-10-01T00:00:00.000Z',
    })
    const body = await (await GET(request('?jobs=auditLogs'))).json()
    expect(body.results.auditLogs.detail).toEqual({
      deleted: 0,
      retentionDays: 365,
      cutoff: '2025-10-01T00:00:00.000Z',
    })
  })
})
