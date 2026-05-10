import { NextRequest } from 'next/server'
import { withEvlog, useLogger, createError } from '@/lib/evlog'
import { auth } from '@/lib/auth'

export const POST = withEvlog(async (request: NextRequest) => {
  const log = useLogger()
  const session = await auth.api.getSession({ headers: request.headers })

  if (session?.user) {
    log.set('actor', { id: session.user.id, email: session.user.email })
  }

  try {
    const { token, action } = await request.json()
    const secretKey = process.env.TURNSTILE_SECRET_KEY

    log.set('body', {
      token: token ? token.slice(0, 10) + '...' : null,
      action,
    })

    if (!token) {
      throw createError({
        message: 'Missing token',
        status: 400,
        why: 'No CAPTCHA token',
        fix: 'Provide token',
      })
    }
    
    if (!secretKey) {
      throw createError({
        message: 'Missing secret',
        status: 500,
        why: 'Server config',
        fix: 'Add key',
      })
    }

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: secretKey,
          response: token,
        }).toString(),
      },
    )

    if (!response.ok) {
      throw createError({
        message: 'Cloudflare error',
        status: 500,
        why: 'Cloudflare status ' + response.status,
        fix: 'Check service',
      })
    }

    const data = await response.json()
    log.set('cloudflareResponse', data)

    if (data.success) {
      log.audit({
        action: 'verify_captcha',
        actor: session?.user ? { id: session.user.id, email: session.user.email } : { id: 'anonymous' },
        target: 'turnstile',
        outcome: 'success',
      })
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } else {
      throw createError({
        message: 'Verification failed',
        status: 400,
        why: 'Token rejected',
        fix: 'Check Cloudflare codes',
      })
    }
  } catch (error: any) {
    if (error.status) throw error
    throw createError({
      message: 'Server error',
      status: 500,
      why: error.message,
      fix: 'Check server logs',
    })
  }
})
