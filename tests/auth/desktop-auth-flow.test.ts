// @vitest-environment node
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { memoryAdapter } from '@better-auth/memory-adapter'
import { twoFactor } from 'better-auth/plugins'
import {
  createMcpOAuthPlugins,
  createDesktopAuthPlugin,
} from '@zntr/auth/server'
import { authSchema } from '@zntr/auth/schema'
import { desktopDatabase } from './desktop-db'

const ORIGIN = 'https://calendar.example'
const desktop = {
  clientId: 'zentra-desktop-dev',
  redirectUri: 'app.zntr.calendar.dev:/oauth/callback',
  resource: `${ORIGIN}/api/desktop`,
}

function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .join('; ')
}

function totp(uri: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const secret = new URL(uri).searchParams.get('secret')!
  const bits = [...secret.toUpperCase().replace(/=+$/, '')]
    .map((character) =>
      alphabet.indexOf(character).toString(2).padStart(5, '0'),
    )
    .join('')
  const key = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const hash = createHmac('sha1', key).update(counter).digest()
  return ((hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1_000_000)
    .toString()
    .padStart(6, '0')
}

function createFixture(
  database?: BetterAuthOptions['database'],
  requireEmailVerification = false,
) {
  let verificationURL = ''
  const memory = Object.fromEntries(
    Object.keys(authSchema).map((key) => [key, []]),
  )
  const auth: ReturnType<typeof betterAuth> = betterAuth({
    baseURL: ORIGIN,
    secret: 'desktop-auth-integration-secret-with-sufficient-length',
    database: database ?? memoryAdapter(memory),
    emailAndPassword: { enabled: true, requireEmailVerification },
    emailVerification: {
      sendOnSignUp: requireEmailVerification,
      async sendVerificationEmail({ url }) {
        verificationURL = url
      },
    },
    trustedOrigins: [ORIGIN],
    rateLimit: { enabled: false },
    plugins: [
      createDesktopAuthPlugin(desktop, (input: Request) => auth.handler(input)),
      twoFactor({ issuer: 'Zentra Calendar' }),
      ...createMcpOAuthPlugins(
        {
          resource: `${ORIGIN}/api/mcp`,
          loginPage: '/oauth/sign-in',
          consentPage: '/oauth/consent',
          verificationUri: '/oauth/device',
          scopes: ['events:read', 'offline_access'],
        },
        desktop,
      ),
    ],
  })
  const send = (path: string, cookie = '', body?: unknown) =>
    auth.handler(
      new Request(`${ORIGIN}/api/auth/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { origin: ORIGIN, cookie, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    )
  const signup = async (email = 'desktop@example.com') => {
    const response = await send('sign-up/email', '', {
      name: 'Desktop User',
      email,
      password: 'correct horse battery staple',
    })
    expect(response.status, await response.clone().text()).toBe(200)
    return cookies(response)
  }
  const authorize = async (
    cookie: string,
    overrides: Record<string, string> = {},
  ) => {
    const verifier = randomBytes(32).toString('base64url')
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: desktop.clientId,
      redirect_uri: desktop.redirectUri,
      scope: 'openid profile email desktop:session',
      resource: desktop.resource,
      state: 'desktop-state',
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      ...overrides,
    })
    return {
      response: await send(`oauth2/authorize?${query}`, cookie),
      verifier,
    }
  }
  const exchange = async (cookie: string) => {
    const { response, verifier } = await authorize(cookie)
    expect(response.status, await response.clone().text()).toBe(302)
    const callback = new URL(response.headers.get('location')!)
    expect(callback.protocol).toBe('app.zntr.calendar.dev:')
    expect(callback.pathname).toBe('/oauth/callback')
    expect(callback.searchParams.get('state')).toBe('desktop-state')
    const body = {
      code: callback.searchParams.get('code'),
      codeVerifier: verifier,
    }
    const result = await send('desktop/exchange', '', body)
    expect(result.status, await result.clone().text()).toBe(200)
    return { response: result, body, cookie: cookies(result) }
  }
  const link = async (
    cookie: string,
    destination = '/account?section=security',
  ) => {
    const response = await send('desktop/browser-link', cookie, { destination })
    expect(response.status, await response.clone().text()).toBe(200)
    const url = new URL((await response.json()).url)
    expect(url.pathname).toBe('/desktop/continue')
    expect(url.search).toBe('')
    return url.hash.slice(1)
  }
  return {
    send,
    signup,
    authorize,
    exchange,
    link,
    verifyEmail: () => auth.handler(new Request(verificationURL)),
  }
}

describe.each(['memory', 'PostgreSQL'])(
  'desktop browser sign-in (%s)',
  (storage) => {
    let db: Awaited<ReturnType<typeof desktopDatabase>> | undefined
    const usePostgres = storage === 'PostgreSQL'
    const enabled =
      !usePostgres || process.env.DESKTOP_AUTH_DATABASE_TEST === '1'
    const fixture = (verified = false) => createFixture(db?.database, verified)
    beforeAll(async () => {
      if (usePostgres && enabled) db = await desktopDatabase()
    })
    afterEach(async () => {
      await db?.reset()
    })
    afterAll(async () => {
      await db?.cleanup()
    })
    describe.skipIf(!enabled)('protocol contract', () => {
      it('requires browser email verification before issuing desktop authorization', async () => {
        const f = fixture(true)
        const pending = await f.signup()
        expect((await f.send('desktop/session', pending)).status).toBe(401)
        const blocked = await f.authorize(pending)
        expect(
          new URL(
            blocked.response.headers.get('location')!,
            ORIGIN,
          ).searchParams.has('code'),
        ).toBe(false)
        const credentials = {
          email: 'desktop@example.com',
          password: 'correct horse battery staple',
        }
        expect((await f.send('sign-in/email', '', credentials)).status).toBe(
          403,
        )
        const verified = await f.verifyEmail()
        expect([200, 302]).toContain(verified.status)
        const signedIn = await f.send('sign-in/email', '', credentials)
        expect(signedIn.status).toBe(200)
        const desktop = await f.exchange(cookies(signedIn))
        expect((await desktop.response.json()).user.emailVerified).toBe(true)
      })

      it('keeps a pending second factor out of the desktop OAuth flow', async () => {
        const f = fixture()
        const browser = await f.signup()
        const enabled = await f.send('two-factor/enable', browser, {
          password: 'correct horse battery staple',
        })
        expect(enabled.status, await enabled.clone().text()).toBe(200)
        const { totpURI } = await enabled.json()
        const enrolled = await f.send(
          'two-factor/verify-totp',
          cookies(enabled) || browser,
          {
            code: totp(totpURI),
          },
        )
        expect(enrolled.status, await enrolled.clone().text()).toBe(200)
        await f.send(
          'sign-out',
          cookies(enrolled) || cookies(enabled) || browser,
          {},
        )
        const challenge = await f.send('sign-in/email', '', {
          email: 'desktop@example.com',
          password: 'correct horse battery staple',
        })
        expect(challenge.status).toBe(200)
        expect((await challenge.json()).twoFactorRedirect).toBe(true)
        const pending = cookies(challenge)
        expect((await f.send('desktop/session', pending)).status).toBe(401)
        const blocked = await f.authorize(pending)
        expect(
          new URL(
            blocked.response.headers.get('location')!,
            ORIGIN,
          ).searchParams.has('code'),
        ).toBe(false)
        const verified = await f.send('two-factor/verify-totp', pending, {
          code: totp(totpURI),
        })
        expect(verified.status, await verified.clone().text()).toBe(200)
        const desktop = await f.exchange(cookies(verified))
        expect((await desktop.response.json()).user.twoFactorEnabled).toBe(true)
      })

      it('creates an independent session without returning credentials to the renderer', async () => {
        const f = fixture()
        const browser = await f.signup()
        const desktop = await f.exchange(browser)
        expect(desktop.cookie).toContain('session_token')
        expect(desktop.cookie).not.toBe(browser)
        const result = await desktop.response.json()
        expect(result.user.email).toBe('desktop@example.com')
        expect(result).not.toHaveProperty('access_token')
        expect(result).not.toHaveProperty('token')
        expect((await f.send('sign-out', browser, {})).status).toBe(200)
        const restored = await f.send('desktop/session', desktop.cookie)
        expect(restored.status).toBe(200)
        expect((await restored.json()).user.email).toBe('desktop@example.com')
        expect(
          (await f.send('desktop/exchange', '', desktop.body)).status,
        ).toBe(401)
      })

      it('rejects an incorrect PKCE verifier without issuing a session', async () => {
        const f = fixture()
        const { response } = await f.authorize(await f.signup())
        const code = new URL(
          response.headers.get('location')!,
        ).searchParams.get('code')
        const rejected = await f.send('desktop/exchange', '', {
          code,
          codeVerifier: randomBytes(32).toString('base64url'),
        })
        expect(rejected.status).toBe(401)
        expect(cookies(rejected)).not.toContain('session_token')
      })

      it.each([
        { redirect_uri: 'https://attacker.example/callback' },
        { redirect_uri: 'app.zntr.calendar:/oauth/callback' },
        { code_challenge_method: 'plain' },
      ])('rejects changed callback or PKCE policy: %j', async (overrides) => {
        const f = fixture()
        const { response } = await f.authorize(await f.signup(), overrides)
        const location = response.headers.get('location')
        expect(
          location ? new URL(location, ORIGIN).searchParams.has('code') : false,
        ).toBe(false)
        expect(cookies(response)).not.toContain('session_token')
      })

      it('consumes browser handoff once and keeps its browser session after desktop logout', async () => {
        const f = fixture()
        const desktop = await f.exchange(await f.signup())
        const token = await f.link(desktop.cookie)
        const outcomes = await Promise.all([
          f.send('desktop/browser-continue', '', { token }),
          f.send('desktop/browser-continue', '', { token }),
        ])
        expect(outcomes.map((r) => r.status).sort()).toEqual([200, 401])
        const accepted = outcomes.find((r) => r.status === 200)!
        const browserCookie = cookies(accepted)
        expect(browserCookie).not.toBe(desktop.cookie)
        expect(await accepted.json()).toEqual({
          destination: '/account?section=security',
        })
        await f.send('sign-out', desktop.cookie, {})
        expect((await f.send('desktop/session', browserCookie)).status).toBe(
          200,
        )
        expect((await f.send('desktop/session', desktop.cookie)).status).toBe(
          401,
        )
      })

      it('preserves a different account already signed in to the browser', async () => {
        const f = fixture()
        const desktop = await f.exchange(await f.signup())
        const other = await f.signup('other@example.com')
        const response = await f.send('desktop/browser-continue', other, {
          token: await f.link(desktop.cookie),
        })
        expect(response.status).toBe(200)
        expect(cookies(response)).not.toContain('session_token')
        const session = await f.send('desktop/session', other)
        expect((await session.json()).user.email).toBe('other@example.com')
      })

      it('rejects a handoff whose desktop session was revoked', async () => {
        const f = fixture()
        const desktop = await f.exchange(await f.signup())
        const token = await f.link(desktop.cookie)
        await f.send('sign-out', desktop.cookie, {})
        expect(
          (await f.send('desktop/browser-continue', '', { token })).status,
        ).toBe(401)
      })

      it.each([
        'https://attacker.example/app',
        '//attacker.example/app',
        '/api/auth/sign-out',
      ])('rejects a browser handoff to %s', async (destination) => {
        const f = fixture()
        const response = await f.send(
          'desktop/browser-link',
          await f.signup(),
          { destination },
        )
        expect(response.status).toBe(400)
      })
    })
  },
)
