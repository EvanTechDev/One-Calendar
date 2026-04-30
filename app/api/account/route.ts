import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.$transaction(async (tx) => {
    await tx.calendarEvent.deleteMany({ where: { userId: session.userId } })
    await tx.share.deleteMany({ where: { userId: session.userId } })
    await tx.calendarBackup.deleteMany({ where: { userId: session.userId } })
    await tx.session.deleteMany({ where: { userId: session.userId } })
    await tx.user.delete({ where: { id: session.userId } })
  })

  return NextResponse.json({ success: true })
}
