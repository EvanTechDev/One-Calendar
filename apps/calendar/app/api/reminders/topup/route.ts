import { NextResponse } from 'next/server'
import { and, eq, isNotNull } from 'drizzle-orm'
import { getDb } from '@/lib/drizzle/client'
import { calendarEvents } from '@/lib/drizzle/schema'
import { secretMatches } from '@/lib/mcp/cleanup-config'
import {
  pruneSpentReminders,
  reconcileEventReminders,
} from '@/lib/reminders/reconcile'

export const runtime = 'nodejs'

/**
 * Keeps scheduled reminder emails topped up inside the provider's 30-day
 * horizon, and retries whatever failed during a save.
 *
 * Daily is enough, and imprecision is fine: the provider owns punctual delivery,
 * so this job only answers "is everything in the next 30 days scheduled?". That
 * is why Vercel Hobby's daily, ±59-minute cron suffices here even though it is
 * useless for delivery. See
 * ADR-0010 (email reminders are opt-in per event and scheduled through Resend).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const provided = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (!cronSecret || !secretMatches(provided, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const schedule = request.headers.get('x-vercel-cron-schedule')
  console.info('Reminder top-up cron invoked', { schedule })

  try {
    // Only events that actually want email reminders. Reconciliation is
    // idempotent, so a second run in the same day schedules nothing new.
    const events = await getDb()
      .select({
        id: calendarEvents.id,
        userId: calendarEvents.userId,
      })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.emailReminder, true),
          isNotNull(calendarEvents.notificationMinutes),
        ),
      )

    let scheduled = 0
    let cancelled = 0
    let failed = 0

    for (const event of events) {
      try {
        const result = await reconcileEventReminders({
          userId: event.userId,
          eventId: event.id,
          // The cron never refuses loudly: over-quota events are simply skipped
          // and retried tomorrow.
          strictQuota: false,
        })
        scheduled += result.scheduled
        cancelled += result.cancelled
      } catch {
        failed++
      }
    }

    // Rows whose send is a day past are spent.
    const pruned = await pruneSpentReminders(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    )

    return NextResponse.json({
      events: events.length,
      scheduled,
      cancelled,
      pruned,
      failed,
    })
  } catch (error) {
    console.error('Reminder top-up failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
