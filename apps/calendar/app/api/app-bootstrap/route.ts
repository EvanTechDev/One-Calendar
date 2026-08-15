import { NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { settings } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/auth/server'

export const runtime = 'nodejs'

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

  return NextResponse.json({ authenticated: true, initialized: true })
}
