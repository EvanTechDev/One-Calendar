// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { getAuthTables } from 'better-auth/db'
import { createAuth } from '@zntr/auth/server'
import { authSchema, session, verification } from '@zntr/auth/schema'

const callbacks = {
  sendResetPassword: vi.fn(async () => {}),
  sendVerificationEmail: vi.fn(async () => {}),
}

function buildAuth() {
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [] }),
      }),
    }),
    insert: () => ({
      values: (value: unknown) => ({ returning: async () => [value] }),
    }),
  }
  return createAuth({
    db: db as never,
    baseURL: 'https://calendar.example',
    trustedOrigins: ['https://calendar.example'],
    secret: 'test-secret-long-enough-for-oauth-provider',
    password: {
      hash: async (password) => password,
      verify: async ({ hash, password }) => hash === password,
    },
    emailCallbacks: callbacks,
    plugins: {
      mcpOAuth: {
        resource: 'https://calendar.example/api/mcp',
        loginPage: '/oauth/sign-in',
        consentPage: '/oauth/consent',
        verificationUri: '/oauth/device',
        scopes: ['offline_access', 'events:read'],
      },
    },
  }).auth
}

describe('Better Auth MCP OAuth provider', () => {
  it('mounts the complete protocol endpoint surface', () => {
    const api = buildAuth().api as Record<string, unknown>

    for (const endpoint of [
      'oauth2Authorize',
      'oauth2Consent',
      'oauth2Token',
      'registerOAuthClient',
      'oauth2Introspect',
      'oauth2Revoke',
      'deviceCode',
      'deviceApprove',
      'deviceDeny',
    ]) {
      expect(api[endpoint], endpoint).toBeTypeOf('function')
    }
  })

  it('provides every adapter model required by the mounted plugins', () => {
    const tables = getAuthTables(buildAuth().options)
    for (const model of [
      'jwks',
      'oauthClient',
      'oauthResource',
      'oauthClientResource',
      'oauthRefreshToken',
      'oauthAccessToken',
      'oauthConsent',
      'oauthClientAssertion',
      'deviceCode',
    ]) {
      expect(tables).toHaveProperty(model)
      expect(authSchema).toHaveProperty(model)
    }
  })

  it('matches the timezone-less timestamps in the live auth tables', () => {
    expect(session.expiresAt.withTimezone).toBe(false)
    expect(verification.expiresAt.withTimezone).toBe(false)
  })
})
