import { NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { settings } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getAuthedUser } from '@/lib/api-helpers'

export const runtime = 'nodejs'

const DEFAULT_SETTINGS = {}

/**
 * POST /api/init
 *
 * Initialises default data for a newly registered user whose account row
 * exists but who has no settings yet.
 *
 * The endpoint is idempotent – calling it again after the user already has
 * a settings row is a no-op.
 *
 * Returns:
 *   { initialized: true }  – first-time setup was performed
 *   { initialized: false } – user already had data, nothing changed
 */
export const POST = async function POST() {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()

  // Check if user already has a settings row (used as the "has been
  // initialised" marker).
  const existing = await db
    .select({ userId: settings.userId })
    .from(settings)
    .where(eq(settings.userId, user.id))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ initialized: false })
  }

  // --- First-time initialisation ---

  // Create default settings
  await db.insert(settings).values({
    userId: user.id,
    data: DEFAULT_SETTINGS,
    updatedAt: new Date(),
  })

  return NextResponse.json({ initialized: true })
}
