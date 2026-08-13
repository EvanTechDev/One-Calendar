import { NextResponse } from 'next/server'
import { toNextJsHandler } from '@zntr/auth'
import { auth } from '@/lib/auth'
import { invalidateCachedSession } from '@/lib/cache/session'
import { getDb } from '@/lib/drizzle/client'
import { user as users } from '@/lib/drizzle/schema'
import { anonymousAuditActor, withEvlog, useLogger } from '@/lib/evlog'
import { verifyTurnstile, type TurnstileVerifyResult } from '@/lib/turnstile'
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

function sessionTokenFromCookieHeader(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/(?:^|;\s*)better-auth\.session_token=([^;]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

async function findUserByEmail(email: string) {
  const [result] = await getDb()
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

  if (
    request.method === 'POST' &&
    (action === 'auth.login' || action === 'auth.register')
  ) {
    const turnstileToken =
      typeof body?.turnstileToken === 'string' ? body.turnstileToken : ''
    if (!turnstileToken) {
      return NextResponse.json({ error: 'CAPTCHA required' }, { status: 400 })
    }

    let captchaResult: TurnstileVerifyResult
    try {
      captchaResult = await verifyTurnstile(
        turnstileToken,
        action === 'auth.register' ? 'register' : 'login',
      )
    } catch (error) {
      console.error('CAPTCHA service unavailable', error)
      return NextResponse.json(
        { error: 'CAPTCHA service unavailable' },
        { status: 503 },
      )
    }

    if (!captchaResult.success) {
      const email = typeof body?.email === 'string' ? body.email : undefined
      const subject = await resolveAuthSubject(request, email)
      log.audit?.({
        action: 'captcha.fail',
        actor: anonymousAuditActor,
        target: subject.target,
        outcome: 'failure',
        reason: 'CAPTCHA verification failed',
      })
      return NextResponse.json(
        { error: 'CAPTCHA verification failed' },
        { status: 400 },
      )
    }
  }

  const email = typeof body?.email === 'string' ? body.email : undefined
  let subject = await resolveAuthSubject(request, email)
  const response =
    await authHandlers[request.method as keyof typeof authHandlers](request)

  if (action === 'auth.logout' && response.status < 400) {
    const token = sessionTokenFromCookieHeader(request.headers.get('cookie'))
    if (token) await invalidateCachedSession(token)
  }

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
