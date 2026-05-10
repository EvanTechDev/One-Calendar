import { auth } from '@/lib/auth'
import { db } from '@/lib/drizzle/client'
import { user as users } from '@/lib/drizzle/schema'
import { anonymousAuditActor, withEvlog, useLogger } from '@/lib/evlog'
import { toNextJsHandler } from 'better-auth/next-js'
import { eq } from 'drizzle-orm'

const authHandlers = toNextJsHandler(auth)

type AuthAuditSubject = {
  actor:
    | typeof anonymousAuditActor
    | { type: 'user'; id: string; email?: string }
  target: { type: 'auth_identity'; id: string; email?: string }
}

async function readAuthBody(request: Request) {
  if (request.method !== 'POST') return null
  try {
    return (await request.clone().json()) as Record<string, unknown>
  } catch {
    return null
  }
}

function authAction(pathname: string) {
  if (pathname.endsWith('/sign-in/email')) return 'auth.login'
  if (pathname.endsWith('/sign-out')) return 'auth.logout'
  if (pathname.endsWith('/sign-up/email')) return 'auth.register'
  if (pathname.includes('/reset-password')) return 'auth.password_reset'
  return null
}

async function findUserByEmail(email: string) {
  const [result] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  return result ?? null
}

async function getExistingSessionSubject(
  request: Request,
): Promise<AuthAuditSubject | null> {
  const session = await auth.api.getSession({ headers: request.headers })
  const user = session?.user
  if (!user?.id) return null

  return {
    actor: {
      type: 'user',
      id: user.id,
      ...(user.email ? { email: user.email } : {}),
    },
    target: {
      type: 'auth_identity',
      id: user.id,
      ...(user.email ? { email: user.email } : {}),
    },
  }
}

async function resolveAuthSubject(
  request: Request,
  email?: string,
): Promise<AuthAuditSubject> {
  const sessionSubject = await getExistingSessionSubject(request)
  if (sessionSubject) return sessionSubject

  if (email) {
    const user = await findUserByEmail(email)
    if (user) {
      return {
        actor: anonymousAuditActor,
        target: { type: 'auth_identity', id: user.id, email: user.email },
      }
    }
  }

  return {
    actor: anonymousAuditActor,
    target: {
      type: 'auth_identity',
      id: 'unknown',
      ...(email ? { email } : {}),
    },
  }
}

async function handleAuth(request: Request) {
  const log = useLogger()
  const pathname = new URL(request.url).pathname
  const action = authAction(pathname)
  const body = await readAuthBody(request)
  const email = typeof body?.email === 'string' ? body.email : undefined
  let subject = await resolveAuthSubject(request, email)
  const response =
    await authHandlers[request.method as keyof typeof authHandlers](request)

  if (action) {
    const success = response.status < 400
    if (success && subject.target.id === 'unknown') {
      subject = await resolveAuthSubject(request, email)
    }

    log.audit?.({
      action,
      actor: subject.actor,
      target: subject.target,
      outcome: success ? 'success' : 'failure',
      reason: success
        ? 'Better Auth request completed'
        : `Better Auth request failed with status ${response.status}`,
    })
  }

  return response
}

export const GET = withEvlog(handleAuth)
export const POST = withEvlog(handleAuth)
