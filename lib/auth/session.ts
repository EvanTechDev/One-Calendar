import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'node:crypto'

const SESSION_COOKIE = 'oc_session'

export function randomBase64(size: number) {
  return randomBytes(size).toString('base64')
}

export async function createSession(userId: string) {
  const token = randomBase64(32)
  const sessionSecret = randomBase64(32)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)

  await prisma.session.create({
    data: { userId, token, sessionSecret, expiresAt },
  })

  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })

  return { sessionSecret }
}

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null

  return prisma.session.findUnique({ where: { token }, include: { user: true } })
}

export async function destroySession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { token } })
  }
  ;(await cookies()).delete(SESSION_COOKIE)
}
