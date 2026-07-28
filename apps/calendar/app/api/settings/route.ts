import { type NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { settings } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getAuthedUser } from '@/lib/api-helpers'

export const runtime = 'nodejs'

export type SettingsData = {
  language?: string
  firstDayOfWeek?: number
  timezone?: string
  defaultView?: 'day' | 'week' | 'month' | 'year' | 'four-day'
  timeFormat?: '24h' | '12h'
  theme?: 'light' | 'dark' | 'system'
  enableShortcuts?: boolean
  notificationSound?: string
  toastPosition?: string
  skipLanding?: boolean
  todayToast?: string | null
}

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

  const body: SettingsData = await request.json()

  const existingSettings = await getDb()
    .select()
    .from(settings)
    .where(eq(settings.userId, user.id))

  const merged = {
    ...existingSettings[0]?.data,
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
