import { type NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { settings } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getAuthedUser } from '@/lib/api-helpers'
import { settingsPatchSchema, type SettingsData } from '@/lib/validation'

export const runtime = 'nodejs'

export type { SettingsData }

export const GET = async function GET() {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [result] = await getDb()
    .select()
    .from(settings)
    .where(eq(settings.userId, user.id))

  return NextResponse.json({
    settings: (result?.data ?? {}) as SettingsData,
  })
}

export const PUT = async function PUT(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
  }

  // Validated against the real shape rather than checked for size. The old
  // guards bounded the request but never bounded its contents, so any key
  // could be written into the JSON column and every reader had to assume the
  // value was the one its TypeScript said it was. Unknown keys are dropped
  // here rather than rejected: a newer client may know a setting this build
  // does not.
  const parsed = settingsPatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
  }
  const body = parsed.data

  const existingSettings = await getDb()
    .select()
    .from(settings)
    .where(eq(settings.userId, user.id))

  const merged = {
    ...((existingSettings[0]?.data ?? {}) as SettingsData),
    ...body,
  }

  await getDb()
    .insert(settings)
    .values({
      userId: user.id,
      data: merged,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.userId,
      set: {
        data: merged,
        updatedAt: new Date(),
      },
    })

  return NextResponse.json({ success: true, settings: merged as SettingsData })
}
