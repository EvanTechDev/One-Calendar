import {
  auditEnricher,
  auditOnly,
  signed,
  type AuditActor,
  type RequestLogger,
} from 'evlog'
import { createAuthMiddleware } from 'evlog/better-auth'
import { createEvlog } from 'evlog/next'
import { auth } from '@/lib/auth'

const identify = createAuthMiddleware(auth)

const mainDrain = async (ctx: unknown) => {
  console.log(JSON.stringify(ctx))
}

const auditDrain = auditOnly(
  signed(
    async (ctx: unknown) => {
      console.log(JSON.stringify(ctx))
    },
    {
      strategy: 'hash-chain',
    },
  ),
  { await: true },
)

export const anonymousAuditActor = {
  type: 'system',
  id: 'anonymous',
} satisfies AuditActor

function actorFromEvent(event: Record<string, unknown>): AuditActor | null {
  const user = event.user
  if (user && typeof user === 'object') {
    const candidate = user as Record<string, unknown>
    if (typeof candidate.id === 'string') {
      return {
        type: 'user',
        id: candidate.id,
        ...(typeof candidate.email === 'string'
          ? { email: candidate.email }
          : {}),
        ...(typeof candidate.name === 'string'
          ? { displayName: candidate.name }
          : {}),
      }
    }
  }

  if (typeof event.userId === 'string') {
    return { type: 'user', id: event.userId }
  }

  return null
}

export function getAuditActor(
  logger: Pick<RequestLogger, 'getContext'>,
  fallback: AuditActor = anonymousAuditActor,
) {
  return actorFromEvent(logger.getContext()) ?? fallback
}

const auditEnrich = auditEnricher({
  bridge: {
    getSession: ({ event }) => actorFromEvent(event as Record<string, unknown>),
  },
})

const evlog = createEvlog({
  service: 'one-calendar',
  drain: async (ctx) => {
    const results = await Promise.allSettled([mainDrain(ctx), auditDrain(ctx)])
    const rejected = results.find((r) => r.status === 'rejected')
    if (rejected?.status === 'rejected') throw rejected.reason
  },
  enrich: auditEnrich,
})

const withEvlogBase = evlog.withEvlog

export const withEvlog: typeof evlog.withEvlog = (handler) =>
  withEvlogBase(async (...args: Parameters<typeof handler>) => {
    const request = args[0]
    if (request instanceof Request) {
      const log = evlog.useLogger()
      await identify(log, request.headers, new URL(request.url).pathname)
    }
    return handler(...args)
  })

export const { useLogger, log, createError, createEvlogError } = evlog
