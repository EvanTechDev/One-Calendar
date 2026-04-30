import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth/session'

export async function POST(req: Request) {
  const body = await req.json()
  const { email, authSalt, keySalt, backupSalt, authHash, wrappedMasterKey, wrappedMasterKeyIv } = body

  const hashedAuth = await bcrypt.hash(authHash, 12)

  const user = await prisma.user.create({
    data: {
      email: String(email).toLowerCase(),
      authSalt,
      keySalt,
      backupSalt,
      authHash: hashedAuth,
      wrappedMasterKey,
      wrappedMasterKeyIv,
    },
  })

  const session = await createSession(user.id)
  return NextResponse.json(session)
}
