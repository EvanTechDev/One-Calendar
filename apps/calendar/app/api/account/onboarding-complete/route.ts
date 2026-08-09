import { NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { user } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getAuthedUser } from '@/lib/api-helpers'

export const runtime = 'nodejs'

/**
 * POST /api/account/onboarding-complete
 *
 * Marks the current user as having completed onboarding.
 * Idempotent — calling multiple times is a no-op.
 */
export const POST = async function POST() {
  const currentUser = await getAuthedUser()
  if (!currentUser)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await getDb()
    .update(user)
    .set({ onboardingCompleted: true })
    .where(eq(user.id, currentUser.id))

  return NextResponse.json({ success: true })
}
