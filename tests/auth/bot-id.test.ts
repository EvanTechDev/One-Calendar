import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withBotId } from 'botid/next/config'
import { botIdPlugin, rejectBotRequest } from '@zntr/auth/bot-id'
import {
  BOT_ID_ENDPOINTS,
  BOT_ID_OPTIONS,
  BOT_ID_PROXY_PREFIX,
  BOT_ID_ROUTES,
  botIdIsGuarded,
} from '@zntr/auth/bot-policy'
import { authRouteIsExposed } from '@zntr/auth/route-policy'

const { check } = vi.hoisted(() => ({ check: vi.fn() }))
vi.mock('botid/server', () => ({ checkBotId: check }))

beforeEach(() => {
  check.mockReset().mockResolvedValue({ isBot: false })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

const plugin = botIdPlugin()
const ctx = {
  options: { basePath: '/api/auth' },
  logger: { error: vi.fn() },
} as never

function onRequest(method: string, path: string) {
  const request = new Request(`https://zentra.test/api/auth/${path}`, {
    method,
  })
  return plugin.onRequest!(request, ctx) as Promise<
    { response: Response } | undefined
  >
}

describe('browser BotID boundary', () => {
  it.each(BOT_ID_ROUTES)(
    'verifies $path before accepting it',
    async ({ path, method, advancedOptions }) => {
      const route = path.slice('/api/auth/'.length)
      expect(authRouteIsExposed(method, route)).toBe(true)
      expect(botIdIsGuarded(method, route)).toBe(true)
      expect(botIdIsGuarded('GET', route)).toBe(false)
      expect(BOT_ID_ENDPOINTS).toContain(`/${route}`)
      expect(advancedOptions).toEqual(BOT_ID_OPTIONS)
      expect(await onRequest(method, route)).toBeUndefined()
      expect(check).toHaveBeenCalledWith({ advancedOptions })
      check.mockResolvedValueOnce({ isBot: true, isVerifiedBot: true })
      expect((await onRequest(method, route))?.response.status).toBe(403)
    },
  )

  it('fails closed when verification or deployment credentials are unavailable', async () => {
    check.mockRejectedValue(new Error('OIDC unavailable'))
    const result = await onRequest('POST', 'sign-in/email')
    expect(result?.response.status).toBe(500)
    expect(await result?.response.json()).toMatchObject({
      code: 'UNKNOWN_ERROR',
    })
  })

  it.each([{}, { isBot: null }, { isBot: 'false' }])(
    'rejects an inconclusive provider response: %j',
    async (verdict) => {
      check.mockResolvedValueOnce(verdict)
      const result = await onRequest('POST', 'sign-in/email')
      expect(result?.response.status).toBe(403)
    },
  )

  it.each([
    'oauth2/token',
    'oauth2/authorize',
    'oauth2/introspect',
    'oauth2/register',
    'desktop/exchange',
    'desktop/session',
    'desktop/browser-link',
    'desktop/browser-continue',
    'get-session',
    'sign-out',
    'change-password',
    'reset-password',
    'two-factor/verify-totp',
  ])('does not require browser instrumentation for %s', async (path) => {
    expect(await onRequest('POST', path)).toBeUndefined()
    expect(check).not.toHaveBeenCalled()
  })

  it('guards app-owned API routes with the same verdict rules', async () => {
    expect(await rejectBotRequest()).toBeNull()
    check.mockResolvedValueOnce({ isBot: true })
    expect((await rejectBotRequest())?.status).toBe(403)
    check.mockResolvedValueOnce({})
    expect((await rejectBotRequest())?.status).toBe(503)
    check.mockRejectedValueOnce(new Error('OIDC unavailable'))
    expect((await rejectBotRequest())?.status).toBe(503)
  })

  it('keeps the CSP exception aligned with the installed SDK proxy', async () => {
    const config = withBotId({
      headers: async () => [
        {
          source: '/:path*',
          headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
        },
      ],
    })
    const headers = await config.headers!()
    expect(headers[0].headers).toContainEqual({
      key: 'X-Frame-Options',
      value: 'DENY',
    })
    const botHeaders = headers.find(
      (entry) => entry.source === `${BOT_ID_PROXY_PREFIX}:path*`,
    )
    expect(botHeaders?.headers).toContainEqual({
      key: 'X-Frame-Options',
      value: 'SAMEORIGIN',
    })
  })
})
