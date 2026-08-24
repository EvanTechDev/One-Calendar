import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { deleteExpiredMeetings } from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'

export const runtime = 'nodejs'

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Removes expired guest Meetings (ADR 0018: guest Instant Meetings live for
 * seven days; signed-in and Event Meetings have no expiry). Anonymous
 * creation means the table would otherwise accumulate abandoned rows.
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

  try {
    const deleted = await deleteExpiredMeetings(getDb())
    console.info('Meeting cleanup cron removed expired meetings', {
      count: deleted.length,
    })
    return NextResponse.json({ deleted: deleted.length })
  } catch (error) {
    console.error('[meetings:cleanup]', error)
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}
