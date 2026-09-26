import { NextResponse } from 'next/server'
import { parseRetentionDays, secretMatches } from '@/lib/mcp/cleanup-config'
import { maintenanceSucceeded, runMaintenance } from '@/lib/maintenance/jobs'

export const runtime = 'nodejs'

/**
 * The MCP subset of the daily maintenance run, kept as its own route for the
 * cron that has always pointed at it and for poking at just those two jobs.
 * The jobs themselves live in `lib/maintenance/jobs.ts`, shared with
 * `/api/blob/check` — one implementation, two ways in.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const provided = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (!cronSecret) {
    console.error('MCP audit cleanup: CRON_SECRET is not set')
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!secretMatches(provided, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const schedule = request.headers.get('x-vercel-cron-schedule')
  // A query param overrides the environment's window, for a deliberate purge
  // (`?retentionDays=1`) or a dry run that touches nothing (`?retentionDays=3650`).
  const retentionDays = parseRetentionDays(
    new URL(request.url).searchParams.get('retentionDays'),
    parseRetentionDays(process.env.MCP_AUDIT_RETENTION_DAYS ?? null),
  )
  console.info('MCP audit cleanup cron invoked', { schedule, retentionDays })

  try {
    const results = await runMaintenance(['auditLogs', 'oauthState'], {
      auditRetentionDays: retentionDays,
    })
    const ok = maintenanceSucceeded(results)
    return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 })
  } catch (error) {
    console.error('MCP audit cleanup failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
