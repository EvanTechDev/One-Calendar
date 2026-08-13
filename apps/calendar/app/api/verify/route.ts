import { NextRequest } from 'next/server'
import { withEvlog, useLogger, createError, getAuditActor } from '@/lib/evlog'
import { verifyTurnstile } from '@/lib/turnstile'

export const POST = withEvlog(async (request: NextRequest) => {
  const log = useLogger()
  try {
    const { token, action } = await request.json()
    const secretKey = process.env.TURNSTILE_SECRET_KEY

    log.set({
      body: {
        token: token ? token.slice(0, 10) + '...' : null,
        action,
      },
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

    const result = await verifyTurnstile(token, action ?? '')

    log.set({
      turnstile: { success: result.success, errorCodes: result.errorCodes },
    })

    if (result.success) {
      log.audit?.({
        action: 'captcha.verify',
        actor: getAuditActor(log),
        target: { type: 'turnstile', id: action ?? 'unknown' },
        outcome: 'success',
        reason: 'CAPTCHA verification succeeded',
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
    console.error('Turnstile verification failed', error)
    throw createError({
      message: 'Server error',
      status: 500,
      why: 'See server logs',
      fix: 'Check server logs',
    })
  }
})