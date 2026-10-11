// @vitest-environment node
/**
 * The job registry itself, one layer below the route.
 *
 * `runMaintenance`'s contract is that a job which throws is recorded as failed
 * and the rest still run. The old implementation ran its jobs in one
 * `Promise.all`, so an OAuth sweep failing turned the audit sweep into a 500
 * too — two unrelated chores sharing one blast radius, and a log line blaming
 * whichever rejected first.
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
  getDb: () => ({
    execute: () => Promise.resolve({ rows: [{ table_name: 'User' }] }),
  }),
}))

import {
  MAINTENANCE_JOBS,
  maintenanceSucceeded,
  runMaintenance,
} from '@/lib/maintenance/jobs'

beforeEach(() => {
  audit.cleanupAuditLogs.mockReset()
  // Echoes the window it was handed, the way the real function reports it.
  audit.cleanupAuditLogs.mockImplementation(async (days?: number) => ({
    deleted: 0,
    retentionDays: days ?? 30,
    cutoff: '2026-09-01T00:00:00.000Z',
  }))
  oauth.cleanupExpiredOAuthState.mockClear()
  meetings.deleteExpiredMeetings.mockClear()
})

describe('runMaintenance', () => {
  it('runs every registered job when none are named', async () => {
    const results = await runMaintenance()
    expect(Object.keys(results).sort()).toEqual(
      Object.keys(MAINTENANCE_JOBS).sort(),
    )
    expect(maintenanceSucceeded(results)).toBe(true)
  })

  it('runs only the named jobs', async () => {
    const results = await runMaintenance(['auditLogs'])
    expect(Object.keys(results)).toEqual(['auditLogs'])
    expect(oauth.cleanupExpiredOAuthState).not.toHaveBeenCalled()
  })

  it('records a failing job without taking the others with it', async () => {
    oauth.cleanupExpiredOAuthState.mockRejectedValue(new Error('db gone'))
    const results = await runMaintenance()
    expect(results.oauthState).toEqual({ ok: false, error: 'db gone' })
    expect(results.auditLogs.ok).toBe(true)
    expect(results.tables.ok).toBe(true)
    expect(maintenanceSucceeded(results)).toBe(false)
  })

  it('names the failing job in the log, not just in the response', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    oauth.cleanupExpiredOAuthState.mockRejectedValue(new Error('db gone'))
    await runMaintenance()
    expect(error).toHaveBeenCalledWith(
      'Maintenance job "oauthState" failed:',
      expect.any(Error),
    )
    error.mockRestore()
  })

  it('forwards the retention override to the audit job', async () => {
    await runMaintenance(['auditLogs'], { auditRetentionDays: 3 })
    expect(audit.cleanupAuditLogs).toHaveBeenCalledWith(3)
  })

  it('leaves the window to the job when no override is given', async () => {
    // Passing undefined is not the same as passing nothing to read: the job's
    // default parameter is what consults MCP_AUDIT_RETENTION_DAYS.
    await runMaintenance(['auditLogs'])
    expect(audit.cleanupAuditLogs).toHaveBeenCalledWith(undefined)
  })

  it('reports the audit window it applied alongside the count', async () => {
    const results = await runMaintenance(['auditLogs'], {
      auditRetentionDays: 90,
    })
    expect(results.auditLogs.detail).toEqual({
      deleted: 0,
      retentionDays: 90,
      cutoff: '2026-09-01T00:00:00.000Z',
    })
  })

  it('counts the expired meetings it removed', async () => {
    meetings.deleteExpiredMeetings.mockResolvedValueOnce([
      { id: 'm1' },
      { id: 'm2' },
    ])
    const results = await runMaintenance(['expiredMeetings'])
    expect(results.expiredMeetings.detail).toEqual({ deleted: 2 })
  })
})

describe('maintenanceSucceeded', () => {
  it('is false when any job failed', () => {
    expect(
      maintenanceSucceeded({
        tables: { ok: true },
        auditLogs: { ok: false, error: 'nope' },
      } as never),
    ).toBe(false)
  })
})
