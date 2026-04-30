import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth/session'

export async function POST(req: Request) {
  const { email, authHash } = await req.json()
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } })
  if (!user) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })

  const ok = await bcrypt.compare(authHash, user.authHash)
  if (!ok) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })

  const session = await createSession(user.id)
  return NextResponse.json(session)
}
