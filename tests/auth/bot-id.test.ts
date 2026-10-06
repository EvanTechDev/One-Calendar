import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withBotId } from 'botid/next/config'
import { rejectBotRequest } from '@zntr/auth/bot-id'
import {
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

describe('browser BotID boundary', () => {
  it.each(BOT_ID_ROUTES)(
    'verifies $path before accepting it',
    async ({ path, method, advancedOptions }) => {
      const route = path.slice('/api/auth/'.length)
      expect(authRouteIsExposed(method, route)).toBe(true)
      expect(botIdIsGuarded(method, route)).toBe(true)
      expect(botIdIsGuarded('GET', route)).toBe(false)
      expect(advancedOptions).toEqual(BOT_ID_OPTIONS)
      expect(await rejectBotRequest(method, route)).toBeNull()
      expect(check).toHaveBeenCalledWith({ advancedOptions })
      check.mockResolvedValueOnce({ isBot: true, isVerifiedBot: true })
      expect((await rejectBotRequest(method, route))?.status).toBe(403)
    },
  )

  it('fails closed when verification or deployment credentials are unavailable', async () => {
    check.mockRejectedValue(new Error('OIDC unavailable'))
    const response = await rejectBotRequest('POST', 'sign-in/email')
    expect(response?.status).toBe(503)
    expect(await response?.json()).toMatchObject({
      error: 'BOT_VERIFICATION_UNAVAILABLE',
    })
  })

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
    expect(await rejectBotRequest('POST', path)).toBeNull()
    expect(check).not.toHaveBeenCalled()
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
