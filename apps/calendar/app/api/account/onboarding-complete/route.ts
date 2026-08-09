import { NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { settings } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getAuthedUser } from '@/lib/api-helpers'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const currentUser = await getAuthedUser()
  if (!currentUser)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()

  let onboardingData: Record<string, unknown> = {}
  try {
    const body = await request.json()
    onboardingData = body.settings || {}
  } catch {
    // No body or invalid JSON - just mark as complete
  }

  const existing = await db
    .select({ data: settings.data })
    .from(settings)
    .where(eq(settings.userId, currentUser.id))
    .limit(1)

  const currentData = ((existing[0]?.data as Record<string, unknown>) || {})
  const mergedData = { ...currentData, ...onboardingData, onboardingCompleted: true }

  if (existing.length > 0) {
    await db
      .update(settings)
      .set({ data: mergedData, updatedAt: new Date() })
      .where(eq(settings.userId, currentUser.id))
  } else {
    await db.insert(settings).values({
      userId: currentUser.id,
      data: mergedData,
      updatedAt: new Date(),
    })
  }

  return NextResponse.json({ success: true })
}

export async function GET() {
  const currentUser = await getAuthedUser()
  if (!currentUser)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()

  const existing = await db
    .select({ data: settings.data })
    .from(settings)
    .where(eq(settings.userId, currentUser.id))
    .limit(1)

  const data = (existing[0]?.data as Record<string, unknown>) || {}
  return NextResponse.json({
    onboardingCompleted: data.onboardingCompleted === true,
    settings: data,
  })
}
