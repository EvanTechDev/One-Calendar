import { NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { settings, calendarCategories } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { encryptField } from '@/lib/field-crypto'
import crypto from 'crypto'
import { getAuthedUser } from '@/lib/api-helpers'

export const runtime = 'nodejs'

const DEFAULT_CATEGORIES = [
  { name: 'Personal', color: '#3B82F6', sortOrder: 0 },
  { name: 'Work', color: '#EF4444', sortOrder: 1 },
  { name: 'Health', color: '#10B981', sortOrder: 2 },
]

const DEFAULT_SETTINGS = {}

/**
 * POST /api/init
 *
 * Initialises default data for a newly registered user whose account row
 * exists but who has no settings / categories yet.
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

  // 1. Create default settings
  await db.insert(settings).values({
    userId: user.id,
    data: DEFAULT_SETTINGS,
    updatedAt: new Date(),
  })

  // 2. Create default categories
  const categoryValues = DEFAULT_CATEGORIES.map((cat) => {
    const id = crypto.randomUUID()
    return {
      id,
      userId: user.id,
      name: encryptField(id, cat.name) ?? '',
      color: cat.color,
      sortOrder: cat.sortOrder,
    }
  })

  if (categoryValues.length > 0) {
    await db.insert(calendarCategories).values(categoryValues)
  }

  return NextResponse.json({ initialized: true })
}
