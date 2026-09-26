import { sql } from 'drizzle-orm'
import { deleteExpiredMeetings } from '@zntr/meetings'
import { getDb } from '@/lib/drizzle/client'
import { cleanupAuditLogs } from '@/lib/mcp/audit'
import { cleanupExpiredOAuthState } from '@/lib/mcp/oauth-cleanup'

/**
 * Every recurring housekeeping job, in one registry.
 *
 * These used to be four separate cron routes across two apps, and all four
 * silently stopped running — the tables they prune had rows well past their
 * retention windows, and expired guest meetings sat in `meeting` for weeks
 * after ADR-0018 said they would be gone. Nothing failed loudly, because a
 * cron that never fires is indistinguishable from a cron that has nothing to
 * do.
 *
 * One registry, one entry point, one line in the response and the log that
 * says what happened. Adding a job means adding a row here, not a route, a
 * vercel.json entry and a second place to remember the secret check.
 */
export interface MaintenanceJob {
  /** Stable key in the response and the log line. */
  name: string
  /**
   * Read-only jobs report what they found; mutating jobs report what they
   * removed. A job that throws is recorded as failed and the rest still run.
   */
  run: (options: MaintenanceOptions) => Promise<Record<string, unknown>>
}

/**
 * Per-run overrides, for the routes that expose a query parameter. Anything
 * omitted falls back to the environment.
 */
export interface MaintenanceOptions {
  /** Overrides the audit retention window, in days. */
  auditRetentionDays?: number
}

export const MAINTENANCE_JOBS = {
  /**
   * The health check this entry point grew out of: the base tables actually
   * present, so a migration that never landed shows up as a missing name
   * rather than as a job that quietly did less than it used to.
   */
  tables: {
    name: 'tables',
    run: async () => {
      const rows = await getDb().execute(sql<{ table_name: string }>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name ASC
      `)
      return { tables: rows.map((row) => row.table_name) }
    },
  },
  /** MCP audit history, trimmed to the retention window. */
  auditLogs: {
    name: 'auditLogs',
    run: async ({ auditRetentionDays }) => ({
      deleted: await cleanupAuditLogs(auditRetentionDays),
    }),
  },
  /** Expired OAuth device codes and client assertions. */
  oauthState: {
    name: 'oauthState',
    run: async () => cleanupExpiredOAuthState(),
  },
  /**
   * Expired guest meetings (ADR-0018). The meet app runs this from its own
   * project; the rows are in this database, so the calendar can sweep them
   * without depending on that deployment's crons.
   */
  expiredMeetings: {
    name: 'expiredMeetings',
    run: async () => ({
      deleted: (await deleteExpiredMeetings(getDb())).length,
    }),
  },
} satisfies Record<string, MaintenanceJob>

export type MaintenanceJobName = keyof typeof MAINTENANCE_JOBS

export interface MaintenanceJobResult {
  ok: boolean
  detail?: Record<string, unknown>
  error?: string
}

/**
 * Runs the named jobs, or all of them, and reports each one.
 *
 * Sequential and never throwing: a job that fails must not take the rest with
 * it. The previous cleanup route ran its two jobs in one `Promise.all`, so a
 * failure in the OAuth sweep turned the audit sweep into a 500 as well — two
 * unrelated chores, one shared blast radius, and a log line that blamed
 * whichever finished rejecting first.
 */
export async function runMaintenance(
  names?: readonly MaintenanceJobName[],
  options: MaintenanceOptions = {},
): Promise<Record<MaintenanceJobName, MaintenanceJobResult>> {
  const selected = names?.length
    ? names
    : (Object.keys(MAINTENANCE_JOBS) as MaintenanceJobName[])

  const results = {} as Record<MaintenanceJobName, MaintenanceJobResult>
  for (const name of selected) {
    const job = MAINTENANCE_JOBS[name]
    try {
      results[name] = { ok: true, detail: await job.run(options) }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Maintenance job "${name}" failed:`, error)
      results[name] = { ok: false, error: message }
    }
  }
  return results
}

/** `true` when every job in the result ran, so a caller can pick a status. */
export function maintenanceSucceeded(
  results: Record<MaintenanceJobName, MaintenanceJobResult>,
): boolean {
  return Object.values(results).every((result) => result.ok)
}
