import { betterAuth } from 'better-auth'
import { emailOTP, jwt, twoFactor } from 'better-auth/plugins'
import { sentinel } from '@better-auth/infra'
import { oauthProvider } from '@better-auth/oauth-provider'
import { createDrizzleAdapter } from './adapter'
import type { CreatePortalOptions } from './types'

/**
 * The authorization server (ADR 0021).
 *
 * Exactly one app calls this — `apps/auth`. It is deliberately a different
 * function from the one client apps use: a client app cannot accidentally
 * construct an authorization server, because the function that builds one is
 * not in its reach. That asymmetry is the point of the split, and it replaces
 * the previous arrangement where every app held an instance that could mint
 * sessions and only a hand-maintained route allowlist stopped it.
 */

/**
 * How long an access token lives.
 *
 * Short because a JWT access token cannot be revoked individually: it is
 * self-contained and never stored, so there is nothing to delete. Expiry plus
 * session-bound invalidation (a token whose session ended reads as inactive at
 * introspection and UserInfo) is the whole control, and a long lifetime would
 * make revocation impossible rather than merely delayed.
 */
const ACCESS_TOKEN_TTL_SECONDS = 600

/**
 * Refresh-token replay tolerance, in seconds.
 *
 * Zero keeps strict detection: reusing a rotated refresh token invalidates the
 * whole family. A non-zero interval exists for clients that legitimately retry a
 * refresh, and none of ours does — a first-party Next.js app has one place that
 * refreshes.
 */
const REFRESH_REUSE_INTERVAL_SECONDS = 0

/**
 * Return type is inferred rather than declared.
 *
 * `betterAuth()` returns a type parameterised by the exact plugin list, and
 * widening it to `AuthInstance` erases every plugin's endpoints — `auth.api`
 * would lose `oauth2Token`, `adminCreateOAuthClient`, and the rest. The portal
 * is the one place that calls those, so the precise type is the useful one.
 */
export function createAuthPortal(options: CreatePortalOptions) {
  const {
    db,
    secret,
    baseURL,
    trustedOrigins,
    advanced,
    emailCallbacks,
    password,
    isDev = false,
  } = options

  // The portal signs every token it issues, so a missing secret must stop
  // startup rather than let Better Auth fall back to anything.
  if (!secret) {
    throw new Error(
      '[createAuthPortal] a secret is required: the portal signs every token it issues',
    )
  }

  // The baseURL is the OAuth issuer, and it appears in every token's `iss`
  // claim. Deriving it from an incoming request would let a request choose its
  // own issuer value, which is the mix-up attack RFC 9207 exists to prevent.
  if (!baseURL) {
    throw new Error(
      '[createAuthPortal] a baseURL is required: it is the OAuth issuer',
    )
  }

  if (!emailCallbacks.sendVerificationOTP && isDev) {
    console.warn(
      '[createAuthPortal] emailCallbacks.sendVerificationOTP is not provided. ' +
        'Verification codes will be logged to the console instead of sent.',
    )
  }

  return {
    auth: betterAuth({
      database: createDrizzleAdapter(db, { provider: 'pg' }),
      secret,
      baseURL,
      trustedOrigins,
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        password,
        sendResetPassword: emailCallbacks.sendResetPassword,
      },
      // `sendVerificationEmail` is deliberately absent from this block: the
      // emailOTP plugin implements `overrideDefaultEmailVerification` from its
      // `init`, and Better Auth folds plugin options in with
      // `defu(options, pluginOptions)` — which keeps the value already present.
      // A top-level callback here outbids the override, and sign-up sends BOTH
      // a link and a code. That was a real bug; the omission is the fix.
      //
      // Cast because our narrowed `EmailCallbacks` describes the subset of the
      // library's signature we actually use.
      emailVerification: (emailCallbacks.sendChangeEmailVerification
        ? {
            sendChangeEmailVerification:
              emailCallbacks.sendChangeEmailVerification,
          }
        : {}) as never,
      ...(advanced ? { advanced } : {}),
      plugins: [
        // Required by the OAuth provider: ID tokens, JWT access tokens, and
        // back-channel logout all sign with its keys.
        jwt(),
        oauthProvider({
          loginPage: '/sign-in',
          consentPage: '/consent',
          // Every client is first-party and registered deliberately. Open
          // registration is an attack surface with no user until a third-party
          // client exists, at which point enabling it is a decision with its own
          // resource and scope policy.
          allowDynamicClientRegistration: false,
          allowUnauthenticatedClientRegistration: false,
          accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
          refreshTokenReuseInterval: REFRESH_REUSE_INTERVAL_SECONDS,
        }),
        twoFactor({
          issuer: 'Zentra',
          trustDeviceMaxAge: 60 * 60 * 24 * 7,
        }),
        sentinel({
          apiKey: options.sentinelApiKey,
          security: {
            credentialStuffing: { enabled: true },
            compromisedPassword: { enabled: true },
            botBlocking: { action: 'challenge' },
            emailValidation: { enabled: true },
          },
        }),
        emailOTP({
          changeEmail: { enabled: true },
          // Verification is the OTP's job, not a link's. See the
          // `emailVerification` comment above for why the top-level callback
          // must be absent for this to take effect.
          overrideDefaultEmailVerification: true,
          sendVerificationOTP: emailCallbacks.sendVerificationOTP,
        } as never),
      ],
    }),
  }
}
