import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'node:crypto'
import { betterAuthServer } from '@/lib/auth/better-auth'

export function randomBase64(size: number) {
  return randomBytes(size).toString('base64')
}

export async function createSession(userId: string) {
  const sessionSecret = randomBase64(32)

  await betterAuthServer.api.createSession({
    body: {
      userId,
      expiresIn: 60 * 60 * 24 * 7,
    },
    headers: await headers(),
  })

  const latestSession = await prisma.session.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  if (!latestSession) {
    throw new Error('session_create_failed')
  }

  await prisma.session.update({
    where: { id: latestSession.id },
    data: { sessionSecret },
  })

  return { sessionSecret }
}

export async function getSession() {
  const session = await betterAuthServer.api.getSession({
    headers: await headers(),
  })

  if (!session) return null

  const dbSession = await prisma.session.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  })

  return dbSession
}

export async function destroySession() {
  await betterAuthServer.api.signOut({ headers: await headers() })
}
