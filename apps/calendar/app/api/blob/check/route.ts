import { NextResponse } from 'next/server'
import { secretMatches } from '@/lib/mcp/cleanup-config'
import {
  MAINTENANCE_JOBS,
  maintenanceSucceeded,
  runMaintenance,
  type MaintenanceJobName,
} from '@/lib/maintenance/jobs'

export const runtime = 'nodejs'

/**
 * The daily maintenance entry point.
 *
 * The path is still the health check this started as, on purpose: it is
 * already wired to a cron, and renaming it would mean a deployment whose
 * `vercel.json` is being read has to pick up a new path before any of the jobs
 * below run. It is more than a health check now — see `lib/maintenance/jobs.ts`
 * for the jobs and why they are gathered here.
 *
 * `?jobs=auditLogs,expiredMeetings` runs a subset, for when one chore needs
 * poking without waiting a day.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const provided = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  // Fail closed, and say which half is missing: a 401 on an unset secret looks
  // identical to a 401 on a wrong one, and that ambiguity is what left four
  // crons dead for weeks.
  if (!cronSecret) {
    console.error('Maintenance: CRON_SECRET is not set')
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!secretMatches(provided, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requested = new URL(request.url).searchParams.get('jobs')
  const names = requested
    ? (requested.split(',').map((name) => name.trim()) as MaintenanceJobName[])
    : undefined
  const known = Object.keys(MAINTENANCE_JOBS)
  const unknown = (names ?? []).filter(
    (name) => !known.includes(name as MaintenanceJobName),
  )
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: `Unknown job(s): ${unknown.join(', ')}`, jobs: known },
      { status: 400 },
    )
  }

  try {
    const results = await runMaintenance(names)
    const ok = maintenanceSucceeded(results)
    const summary = Object.fromEntries(
      Object.entries(results).map(([name, result]) => [
        name,
        result.ok ? 'ok' : 'failed',
      ]),
    )
    // One line, greppable: "Maintenance ran" with nothing else in the log means
    // this route was never reached at all, which is a different problem from a
    // job that ran and failed, and the two used to look the same.
    console.info('Maintenance ran', {
      jobs: names ?? known,
      summary,
      schedule: request.headers.get('x-vercel-cron-schedule'),
    })
    return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 })
  } catch (error) {
    console.error('Maintenance failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
