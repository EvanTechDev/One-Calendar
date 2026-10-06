import type { BetterAuthPlugin } from 'better-auth'
import { createHash, randomBytes } from 'node:crypto'
import type { GenericEndpointContext } from '@better-auth/core'
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  sessionMiddleware,
  getSessionFromCtx,
} from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import * as z from 'zod'
import type { DesktopAuthOptions } from './types'

export const DESKTOP_SCOPES = ['openid', 'profile', 'email', 'desktop:session']

function handoffIdentifier(token: string) {
  return `desktop-browser:${createHash('sha256').update(token).digest('hex')}`
}

function browserDestination(value: string, origin: string) {
  const url = new URL(value, origin)
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    (!['/app', '/account', '/privacy', '/terms', '/changelog', '/'].includes(
      url.pathname,
    ) &&
      !url.pathname.startsWith('/invite/'))
  ) {
    throw new APIError('BAD_REQUEST', {
      message: 'Unsupported browser destination',
    })
  }
  return `${url.pathname}${url.search}${url.hash}`
}

export function desktopResource(options: DesktopAuthOptions) {
  return {
    identifier: options.resource,
    name: 'Zentra Desktop session exchange',
    accessTokenTtl: 120,
    allowedScopes: DESKTOP_SCOPES,
    metadata: { managedBy: 'zentra-desktop' },
  }
}

async function ensureRecord(
  ctx: GenericEndpointContext,
  model: string,
  where: Array<{ field: string; value: string }>,
  data: Record<string, unknown>,
) {
  const existing = await ctx.context.adapter.findOne<Record<string, unknown>>({
    model,
    where,
  })
  if (existing) return existing
  try {
    return await ctx.context.adapter.create<Record<string, unknown>>({
      model,
      data,
    })
  } catch (error) {
    // Unique keys arbitrate concurrent first requests. An actual storage error
    // still propagates unless another request established this exact record.
    const winner = await ctx.context.adapter.findOne<Record<string, unknown>>({
      model,
      where,
    })
    if (!winner) throw error
    return winner
  }
}

async function ensureClient(
  ctx: GenericEndpointContext,
  options: DesktopAuthOptions,
) {
  const client = await ensureRecord(
    ctx,
    'oauthClient',
    [{ field: 'clientId', value: options.clientId }],
    {
      clientId: options.clientId,
      clientSecret: null,
      userId: null,
      name: 'Zentra Calendar Desktop',
      softwareId: options.clientId,
      applicationType: 'native',
      tokenEndpointAuthMethod: 'none',
      redirectUris: [options.redirectUri],
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      requirePKCE: true,
      skipConsent: true,
      subjectType: 'public',
      scopes: DESKTOP_SCOPES,
      disabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { managedBy: 'zentra-desktop' },
    },
  )
  if (
    client.softwareId !== options.clientId ||
    client.userId != null ||
    client.applicationType !== 'native' ||
    client.tokenEndpointAuthMethod !== 'none' ||
    client.subjectType !== 'public' ||
    client.skipConsent !== true ||
    client.requirePKCE !== true ||
    !Array.isArray(client.redirectUris) ||
    client.redirectUris.length !== 1 ||
    client.redirectUris[0] !== options.redirectUri
  ) {
    throw new APIError('CONFLICT', {
      message:
        'Desktop client registration conflicts with server configuration',
    })
  }
  await ensureRecord(
    ctx,
    'oauthClientResource',
    [
      { field: 'clientId', value: options.clientId },
      { field: 'resourceId', value: options.resource },
    ],
    {
      clientId: options.clientId,
      resourceId: options.resource,
      createdAt: new Date(),
    },
  )
}

function publicUser(user: Record<string, unknown>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled ?? false,
  }
}

export function createDesktopAuthPlugin(
  options: DesktopAuthOptions,
  handle: (request: Request) => Promise<Response>,
): BetterAuthPlugin {
  return {
    id: 'zentra-desktop',
    hooks: {
      before: [
        {
          matcher: (ctx) =>
            ctx.path === '/desktop/exchange' ||
            (ctx.path === '/oauth2/authorize' &&
              ctx.query?.client_id === options.clientId),
          handler: createAuthMiddleware(async (ctx) => {
            await ensureClient(ctx, options)
          }),
        },
      ],
    },
    endpoints: {
      desktopBrowserLink: createAuthEndpoint(
        '/desktop/browser-link',
        {
          method: 'POST',
          use: [sessionMiddleware],
          body: z.object({ destination: z.string().min(1).max(4096) }),
        },
        async (ctx) => {
          const origin = new URL(ctx.context.baseURL).origin
          const destination = browserDestination(ctx.body.destination, origin)
          const token = randomBytes(32).toString('base64url')
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: handoffIdentifier(token),
            value: JSON.stringify({
              userId: ctx.context.session.user.id,
              sessionId: ctx.context.session.session.id,
              destination,
            }),
            expiresAt: new Date(Date.now() + 60_000),
          })
          ctx.setHeader('Cache-Control', 'no-store')
          return ctx.json({ url: `${origin}/desktop/continue#${token}` })
        },
      ),
      desktopBrowserContinue: createAuthEndpoint(
        '/desktop/browser-continue',
        {
          method: 'POST',
          body: z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
        },
        async (ctx) => {
          ctx.setHeader('Cache-Control', 'no-store')
          const record =
            await ctx.context.internalAdapter.consumeVerificationValue(
              handoffIdentifier(ctx.body.token),
            )
          if (!record)
            throw new APIError('UNAUTHORIZED', {
              message:
                'This link has expired. Open the page from the desktop app again.',
            })
          const value = JSON.parse(record.value) as {
            userId: string
            sessionId: string
            destination: string
          }
          const destination = browserDestination(
            value.destination,
            new URL(ctx.context.baseURL).origin,
          )
          // Consume the link even when the browser already has a different user.
          // A desktop navigation must never replace an established browser account.
          if (await getSessionFromCtx(ctx)) return ctx.json({ destination })
          const source = await ctx.context.adapter.findOne<{
            userId: string
            expiresAt: Date
          }>({
            model: 'session',
            where: [{ field: 'id', value: value.sessionId }],
          })
          if (
            !source ||
            source.userId !== value.userId ||
            new Date(source.expiresAt).getTime() <= Date.now()
          ) {
            throw new APIError('UNAUTHORIZED', {
              message: 'Desktop session has expired',
            })
          }
          const user = await ctx.context.internalAdapter.findUserById(
            value.userId,
          )
          if (!user)
            throw new APIError('UNAUTHORIZED', { message: 'Account not found' })
          const session = await ctx.context.internalAdapter.createSession(
            user.id,
          )
          if (!session)
            throw new APIError('INTERNAL_SERVER_ERROR', {
              message: 'Browser session could not be created',
            })
          await setSessionCookie(ctx, { session, user })
          return ctx.json({ destination })
        },
      ),
      desktopExchange: createAuthEndpoint(
        '/desktop/exchange',
        {
          method: 'POST',
          body: z.object({
            code: z.string().min(1).max(4096),
            codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
          }),
        },
        async (ctx) => {
          const baseURL = ctx.context.baseURL.replace(/\/$/, '')
          const headers = new Headers(ctx.request?.headers)
          headers.delete('cookie')
          headers.delete('authorization')
          headers.delete('content-length')
          headers.delete('content-encoding')
          headers.set('origin', new URL(baseURL).origin)
          headers.set('content-type', 'application/x-www-form-urlencoded')
          const tokenResponse = await handle(
            new Request(`${baseURL}/oauth2/token`, {
              method: 'POST',
              headers,
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: options.clientId,
                redirect_uri: options.redirectUri,
                resource: options.resource,
                code: ctx.body.code,
                code_verifier: ctx.body.codeVerifier,
              }),
            }),
          )
          if (!tokenResponse.ok) {
            throw new APIError('UNAUTHORIZED', {
              message: 'Desktop authorization failed',
            })
          }
          const tokens = (await tokenResponse.json()) as {
            access_token?: unknown
          }
          if (typeof tokens.access_token !== 'string') {
            throw new APIError('UNAUTHORIZED', {
              message: 'Desktop authorization failed',
            })
          }
          // Let the provider verify its issued token and resolve the public OIDC
          // subject. The transient OAuth token is never forwarded to the renderer.
          const identityResponse = await handle(
            new Request(`${baseURL}/oauth2/userinfo`, {
              headers: { authorization: `Bearer ${tokens.access_token}` },
            }),
          )
          if (!identityResponse.ok) {
            throw new APIError('UNAUTHORIZED', {
              message: 'Desktop identity could not be verified',
            })
          }
          const identity = (await identityResponse.json()) as { sub?: unknown }
          const user =
            typeof identity.sub === 'string'
              ? await ctx.context.internalAdapter.findUserById(identity.sub)
              : null
          if (!user)
            throw new APIError('UNAUTHORIZED', { message: 'Account not found' })
          const session = await ctx.context.internalAdapter.createSession(
            user.id,
          )
          if (!session) {
            throw new APIError('INTERNAL_SERVER_ERROR', {
              message: 'Desktop session could not be created',
            })
          }
          await setSessionCookie(ctx, { session, user })
          ctx.setHeader('Cache-Control', 'no-store')
          return ctx.json({
            user: publicUser(user),
            expiresAt: session.expiresAt,
          })
        },
      ),
      desktopSession: createAuthEndpoint(
        '/desktop/session',
        {
          method: 'GET',
          use: [sessionMiddleware],
        },
        async (ctx) => {
          ctx.setHeader('Cache-Control', 'no-store')
          return ctx.json({
            user: publicUser(ctx.context.session.user),
            expiresAt: ctx.context.session.session.expiresAt,
          })
        },
      ),
    },
  }
}
