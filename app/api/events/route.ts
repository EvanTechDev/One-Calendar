import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/session'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { ciphertext, iv, wrappedDek, dekIv, startTime, endTime } = await req.json()

  const event = await prisma.calendarEvent.create({
    data: {
      userId: session.userId,
      ciphertext,
      iv,
      wrappedDek,
      dekIv,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    },
  })

  return NextResponse.json(event)
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const events = await prisma.calendarEvent.findMany({
    where: {
      userId: session.userId,
      ...(from && to
        ? {
            startTime: { lte: new Date(to) },
            endTime: { gte: new Date(from) },
          }
        : {}),
    },
    orderBy: { startTime: 'asc' },
  })

  return NextResponse.json(events)
}
