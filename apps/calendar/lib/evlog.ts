import {
  auditEnricher,
  auditOnly,
  signed,
  type AuditActor,
  type RequestLogger,
} from 'evlog'
import { createAuthMiddleware } from 'evlog/better-auth'
import { createEvlog } from 'evlog/next'
import { redactLog } from './redact'

let _evlog: ReturnType<typeof createEvlog> | null = null
let _identifyPromise: Promise<ReturnType<typeof createAuthMiddleware>> | null =
  null

function getEvlog() {
  if (!_evlog) {
    const auditEnrich = auditEnricher({
      bridge: {
        getSession: ({ event }) =>
          actorFromEvent(event as Record<string, unknown>),
      },
    })
    _evlog = createEvlog({
      service: 'one-calendar',
      drain: async (ctx) => {
        const results = await Promise.allSettled([
          mainDrain(ctx),
          auditDrain(ctx),
        ])
        const rejected = results.find((r) => r.status === 'rejected')
        if (rejected?.status === 'rejected') throw rejected.reason
      },
      enrich: auditEnrich,
    })
  }
  return _evlog
}

function getIdentify() {
  if (!_identifyPromise) {
    _identifyPromise = import('@/lib/auth').then((mod) =>
      createAuthMiddleware(mod.auth),
    )
  }
  return _identifyPromise
}

const mainDrain = async (ctx: unknown) => {
  console.log(JSON.stringify(redactLog(ctx)))
}

const auditDrain = auditOnly(
  signed(
    async (ctx: unknown) => {
      console.log(JSON.stringify(redactLog(ctx)))
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

export function withEvlog<T extends (...args: any[]) => any>(handler: T): T {
  const wrapped = async (...args: any[]) => {
    const request = args[0]
    if (request instanceof Request) {
      const log = getEvlog().useLogger()
      const identify = await getIdentify()
      await identify(log, request.headers, new URL(request.url).pathname)
    }
    return handler(...args)
  }
  return getEvlog().withEvlog(wrapped) as T
}

export function useLogger() {
  return getEvlog().useLogger()
}

export function log(...args: any[]) {
  return (getEvlog().log as unknown as (...args: any[]) => void)(...args)
}

export function createError(
  ...args: Parameters<ReturnType<typeof createEvlog>['createError']>
) {
  return getEvlog().createError(...args)
}

export function createEvlogError(
  ...args: Parameters<ReturnType<typeof createEvlog>['createEvlogError']>
) {
  return getEvlog().createEvlogError(...args)
}
