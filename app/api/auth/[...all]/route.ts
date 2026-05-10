import { auth } from '@/lib/auth'
import { withEvlog, useLogger } from '@/lib/evlog'
import { toNextJsHandler } from 'better-auth/next-js'

const authHandlers = toNextJsHandler(auth)

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

async function handleAuth(request: Request) {
  const log = useLogger()
  const pathname = new URL(request.url).pathname
  const action = authAction(pathname)
  const body = await readAuthBody(request)
  const email = typeof body?.email === 'string' ? body.email : undefined
  const response =
    await authHandlers[request.method as keyof typeof authHandlers](request)

  if (action) {
    const success = response.status < 400
    log.audit?.({
      action,
      actor: email
        ? { type: 'user', id: email, email }
        : { type: 'system', id: 'anonymous' },
      target: { type: 'auth_session', id: email ?? 'unknown' },
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
