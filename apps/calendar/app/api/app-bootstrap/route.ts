import { NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { settings, calendarCategories } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { encryptField } from '@/lib/field-crypto'
import crypto from 'crypto'
import { getServerSession } from '@/lib/auth/server'

export const runtime = 'nodejs'

const DEFAULT_CATEGORIES = [
  { name: 'Personal', color: '#3B82F6', sortOrder: 0 },
  { name: 'Work', color: '#EF4444', sortOrder: 1 },
  { name: 'Health', color: '#10B981', sortOrder: 2 },
]

const DEFAULT_SETTINGS = {}

/**
 * GET /api/app-bootstrap
 *
 * Combined session check + init in a single request.
 * Replaces the sequential get-session → init waterfall.
 */
export const GET = async function GET() {
  const session = await getServerSession()

  if (!session?.user) {
    return NextResponse.json({ authenticated: false, initialized: false })
  }

  const db = getDb()

  const existing = await db
    .select({ userId: settings.userId })
    .from(settings)
    .where(eq(settings.userId, session.user.id))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ authenticated: true, initialized: false })
  }

  await db.insert(settings).values({
    userId: session.user.id,
    data: DEFAULT_SETTINGS,
    updatedAt: new Date(),
  })

  const categoryValues = DEFAULT_CATEGORIES.map((cat) => {
    const id = crypto.randomUUID()
    return {
      id,
      userId: session.user.id,
      name: encryptField(id, cat.name) ?? '',
      color: cat.color,
      sortOrder: cat.sortOrder,
    }
  })

  if (categoryValues.length > 0) {
    await db.insert(calendarCategories).values(categoryValues)
  }

  return NextResponse.json({ authenticated: true, initialized: true })
}
