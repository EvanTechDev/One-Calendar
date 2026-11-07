# @zntr/auth

Shared authentication infrastructure for Zentra apps. Built on Better Auth and
Drizzle ORM, it keeps server and client configuration, database tables, auth UI,
email delivery, BotID protection, OAuth/MCP and desktop sign-in, and rate
limiting consistent across the monorepo.

> Private Bun workspace package; it is not published to npm.

## Installation

Add the workspace dependency to the consuming app:

```json
{
  "dependencies": {
    "@zntr/auth": "workspace:*"
  }
}
```

The package owns the Better Auth and adapter versions. Import them through the
subpaths below rather than installing parallel copies. The app supplies its
Drizzle database, React runtime, and password hasher (`bcryptjs` in this example).

## Quick start

### 1. Create the server instance

```ts
// lib/auth/index.ts
import bcrypt from 'bcryptjs'
import { createAuth } from '@zntr/auth/server'
import { authEmailBrand } from '@zntr/auth/email-brand'
import { authEmailCallbacks, resendSender } from '@zntr/auth/email'
import { getDb } from '@/lib/drizzle/client'

const baseURL = process.env.BETTER_AUTH_URL

export const { auth } = createAuth({
  db: getDb(),
  ...(baseURL ? { baseURL } : {}),
  trustedOrigins: baseURL ? [baseURL] : [],
  password: {
    hash: async (password) => bcrypt.hash(password, 10),
    verify: async ({ hash, password }) => bcrypt.compare(password, hash),
  },
  emailCallbacks: authEmailCallbacks({
    brand: authEmailBrand({
      appName: 'Your App',
      tagline: 'Your app tagline',
      baseUrl: baseURL,
    }),
    send: resendSender(),
  }),
  plugins: {
    twoFactor: { issuer: 'Your App' },
    emailOTP: { overrideDefaultEmailVerification: true },
  },
  isDev: process.env.NODE_ENV !== 'production',
})
```

`resendSender()` requires `RESEND_API_KEY`. You can instead provide your own
`emailCallbacks`; reset-password and verification-email callbacks are required,
and production email OTP flows should provide `sendVerificationOTP`.

### 2. Create the browser client

```ts
// lib/auth/client.ts
'use client'

import {
  createAuthClient,
  emailOTPClient,
  twoFactorClient,
} from '@zntr/auth/client'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [twoFactorClient(), emailOTPClient()],
})
```

Keep client plugins aligned with the enabled server plugins. To share feature
flags, put them in a separate browser-safe module; never import the server auth
module into client code.

### 3. Mount the Next.js route

```ts
// app/api/auth/[...all]/route.ts
import { toNextJsHandler } from '@zntr/auth'
import { auth } from '@/lib/auth'

export const { GET, POST } = toNextJsHandler(auth)
```

Production hosts should also apply the allowlists in `@zntr/auth/route-policy`
and their rate-limit policy instead of exposing every endpoint added by a
plugin. See `apps/calendar/app/api/auth/[...all]/route.ts` for the full host
integration.

## Exports

Prefer focused subpaths, especially in browser and edge bundles. The root entry
is a convenience barrel and includes server code.

| Import path                      | Purpose                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `@zntr/auth`                     | Core factories, core schema, Next.js handler, cookie helper, `crossAppAuthConfig`, and common types |
| `@zntr/auth/server`              | `createAuth`, MCP/OAuth helpers, and desktop auth plugin                                            |
| `@zntr/auth/client`              | React client plus email OTP, 2FA, Sentinel, and OAuth client plugins                                |
| `@zntr/auth/schema`              | Core and OAuth Drizzle tables, `authSchema`, and `oauthSchema`                                      |
| `@zntr/auth/adapter`             | `createDrizzleAdapter`; normally called by `createAuth`                                             |
| `@zntr/auth/types`               | Option, session, plugin, and result types                                                           |
| `@zntr/auth/forms`               | Shared sign-in, sign-up, reset-password, and layout components with `AuthFormProvider`              |
| `@zntr/auth/account`             | `AccountPanel`, `AccountProvider`, and account context types                                        |
| `@zntr/auth/email`               | Auth email callbacks and the Resend sender                                                          |
| `@zntr/auth/email-brand`         | App-specific sender and email branding                                                              |
| `@zntr/auth/email-template`      | Auth email HTML renderer                                                                            |
| `@zntr/auth/bot-id`              | Better Auth BotID plugin and `rejectBotRequest` for app routes                                      |
| `@zntr/auth/bot-policy`          | Shared guarded-route and BotID client configuration                                                 |
| `@zntr/auth/rate-limit`          | Atomic fixed-window checks and counter cleanup                                                      |
| `@zntr/auth/rate-limit-table`    | Shared `rate_limit_counters` table definition                                                       |
| `@zntr/auth/better-auth-cookies` | Edge-safe `getSessionCookie` export without the server bundle                                       |
| `@zntr/auth/desktop`             | Desktop scopes, resource definition, and auth plugin                                                |
| `@zntr/auth/cimd-fetch`          | SSRF-resistant Client ID Metadata Document fetcher                                                  |
| `@zntr/auth/return-to`           | Allowlisted post-auth redirect resolver                                                             |
| `@zntr/auth/route-policy`        | Auth, OAuth, and desktop route allowlists                                                           |

## Configuration reference

### `createAuth(options)`

| Option             | Required | Notes                                                                          |
| ------------------ | -------- | ------------------------------------------------------------------------------ |
| `db`               | Yes      | Drizzle PostgreSQL handle                                                      |
| `trustedOrigins`   | Yes      | Origins trusted for CORS and cookie validation                                 |
| `password`         | Yes      | Async `hash` and `verify` functions                                            |
| `emailCallbacks`   | Yes      | Reset and verification senders; change-email and OTP senders are optional      |
| `baseURL`          | No       | Canonical app URL; set it explicitly for reliable emailed links                |
| `secret`           | No       | Defaults to Better Auth's `BETTER_AUTH_SECRET` handling                        |
| `advanced`         | No       | Cookie prefix and cross-subdomain cookie settings                              |
| `plugins`          | No       | Plugin configuration; omitted or `false` means disabled                        |
| `disableCsrfCheck` | No       | Defaults to `false`; keep CSRF checks enabled outside specialized native flows |
| `isDev`            | No       | Enables development warnings, including a missing OTP sender                   |

It returns `{ auth, enabledPlugins }`. Supported plugin keys are:

- `twoFactor`: `true` or `{ issuer, otpLength, trustDeviceMaxAge }`.
- `sentinel`: `true` or an API key and security-rule configuration.
- `botId`: `true` to guard shared browser credential and mail endpoints.
- `emailOTP`: `true` or OTP length, expiry, change-email, and verification
  override options.
- `mcpOAuth`: OAuth resource, pages, scopes, and optional token lifetimes.
- `desktop`: `{ clientId, redirectUri, resource }`; requires `mcpOAuth`.

`createDrizzleAdapter(db, options?)` accepts a schema override and defaults to
the PostgreSQL provider. Most consumers should let `createAuth` construct it.

### BotID

Enabling `plugins.botId` protects the Better Auth endpoints. Initialize the
browser side with the same route policy:

```ts
// instrumentation-client.ts
import { initBotId } from 'botid/client/core'
import { BOT_ID_ROUTES } from '@zntr/auth/bot-policy'

initBotId({ protect: BOT_ID_ROUTES })
```

Use `rejectBotRequest()` from `@zntr/auth/bot-id` for app-owned API routes.
Production verification requires Vercel's request/OIDC context; there is no
missing-key bypass.

### Cross-app sessions

`crossAppAuthConfig` returns the `advanced` and `trustedOrigins` values to pass
to `createAuth`. Apps sharing cookies must use the same `AUTH_COOKIE_DOMAIN`,
have byte-identical `BETTER_AUTH_SECRET` values, and be siblings under one
registered domain. Leave `AUTH_COOKIE_DOMAIN` unset for host-only cookies.

### Rate limiting

`checkFixedWindowLimit(db, { name, subject, limit, windowSeconds })` uses one
atomic PostgreSQL upsert and returns `{ allowed, retryAfter }`. Add
`rateLimitCounters` to the app schema and run `cleanupRateLimitCounters(db)`
from maintenance; rows do not expire on their own.

## Schema and migrations

`@zntr/auth/schema` exports the core tables (`user`, `session`, `account`,
`verification`, `twoFactor`) plus the OAuth/JWKS/device tables. Re-export the
tables an app needs from its own Drizzle schema so relations and app tables can
reference them. Include `rateLimitCounters` when using the shared limiter.

All app migrations live in `apps/calendar/drizzle/`. **`drizzle-kit generate`
does not work in this repository.** When changing a table, hand-write the SQL
migration in that directory and mirror the change in the Drizzle schema.

```bash
# Apply committed migrations from apps/calendar
bun x --no-install drizzle-kit migrate
```

For upgrades from Better Auth 1.7.0–1.7.2, apply
`0022_relax_legacy_account_issuer.sql` before deploying 1.7.3 or later.

## Environment

| Variable                         | Used for                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`             | Signing sessions; required in production and identical across apps sharing cookies |
| `BETTER_AUTH_URL`                | Canonical Better Auth base URL when supplied as `baseURL`                          |
| `BETTER_AUTH_API_KEY`            | Optional Sentinel integration                                                      |
| `RESEND_API_KEY`                 | Required by `resendSender()`                                                       |
| `RESEND_SENDER_ADDRESS`          | Optional default mailbox used by `authEmailBrand`                                  |
| `NEXT_PUBLIC_BASE_URL`           | Fallback brand base URL and app-owned public URL configuration                     |
| `AUTH_COOKIE_DOMAIN`             | Optional shared parent domain for cross-app cookies                                |
| `POSTGRES_URL` or `DATABASE_URL` | Consumer app's Drizzle connection                                                  |

## Development

Run commands from the repository root:

```bash
bun run --filter @zntr/auth type-check
bun run --filter @zntr/auth lint:check
bun run --filter @zntr/auth test
bun run --filter @zntr/auth test:watch
bun run --filter @zntr/auth build
```

Database-backed tests use `AUTH_TEST_POSTGRES_URL` and skip when it is unset.
Point it only at a disposable database: the test harness truncates its tables.
