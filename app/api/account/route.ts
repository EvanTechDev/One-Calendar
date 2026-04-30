import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.$transaction([
    prisma.calendarEvent.deleteMany({ where: { userId: session.userId } }),
    prisma.share.deleteMany({ where: { userId: session.userId } }),
    prisma.calendarBackup.deleteMany({ where: { userId: session.userId } }),
    prisma.session.deleteMany({ where: { userId: session.userId } }),
    prisma.user.delete({ where: { id: session.userId } }),
  ])

  return NextResponse.json({ success: true })
}
