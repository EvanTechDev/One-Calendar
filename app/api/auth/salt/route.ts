import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createHash } from 'node:crypto'

function pseudoSalt(email: string, label: string) {
  return createHash('sha256')
    .update(`${label}:${email.toLowerCase()}:one-calendar`)
    .digest('base64')
    .slice(0, 24)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (user) {
    return NextResponse.json({
      authSalt: user.authSalt,
      keySalt: user.keySalt,
      backupSalt: user.backupSalt,
    })
  }

  return NextResponse.json({
    authSalt: pseudoSalt(email, 'auth'),
    keySalt: pseudoSalt(email, 'key'),
    backupSalt: pseudoSalt(email, 'backup'),
  })
}
