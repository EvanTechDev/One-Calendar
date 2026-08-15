import { withRedis } from './client'
import { sessionKey } from './keys'

type Session = {
  user: {
    id: string
    name: string
    email: string
    emailVerified: boolean
    image?: string | null
    twoFactorEnabled?: boolean | null
    createdAt: Date
    updatedAt: Date
  }
  session: {
    id: string
    expiresAt: Date
    token: string
    createdAt: Date
    updatedAt: Date
    ipAddress?: string | null
    userAgent?: string | null
    userId: string
  }
} | null

function computeTtl(expiresAt: Date | string): number {
  const expires = new Date(expiresAt).getTime()
  const now = Date.now()
  const remaining = Math.floor((expires - now) / 1000)
  return Math.min(remaining, 600)
}

export async function getCachedSession(token: string): Promise<Session> {
  return withRedis<Session>(
    async (redis) => {
      const cached = await redis.get(sessionKey(token))
      if (!cached) return null

      try {
        return JSON.parse(cached, (_key, value) => {
          if (
            typeof value === 'string' &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
          ) {
            return new Date(value)
          }
          return value
        }) as Session
      } catch {
        return null
      }
    },
    async () => null,
  )
}

export async function setCachedSession(
  session_: NonNullable<Session>,
): Promise<void> {
  const { session, ...rest } = session_
  const sanitized = {
    ...rest,
    session: { ...session, token: '' },
  }
  const ttl = computeTtl(session.expiresAt)
  if (ttl <= 0) return

  await withRedis<void>(
    async (redis) => {
      await redis.setex(
        sessionKey(session_.session.token),
        ttl,
        JSON.stringify(sanitized),
      )
    },
    async () => {},
  )
}

export async function invalidateCachedSession(token: string): Promise<void> {
  await withRedis<void>(
    async (redis) => {
      await redis.del(sessionKey(token))
    },
    async () => {},
  )
}
