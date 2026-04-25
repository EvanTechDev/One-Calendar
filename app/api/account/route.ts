import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function DELETE() {
  try {
    const user = await currentUser()
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.$transaction(async (tx) => {
      const hasCalendarEventsTable = await tx.$queryRaw<Array<{ ok: number }>>`
        SELECT 1 as ok FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events' LIMIT 1
      `
      if (hasCalendarEventsTable.length > 0) {
        await tx.$executeRaw`DELETE FROM calendar_events WHERE user_id = ${user.id}`
      }

      await tx.share.deleteMany({ where: { userId: user.id } })
      await tx.calendarBackup.deleteMany({ where: { userId: user.id } })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal error' },
      { status: 500 },
    )
  }
}
