# @zntr/auth

Shared Better Auth configuration package for the zntr monorepo. Provides unified authentication infrastructure across all consuming applications.

## Installation

This is a pnpm workspace internal package. Add it to your consumer's `package.json`:

```json
{
  "dependencies": {
    "@zntr/auth": "workspace:*"
  }
}
```

### Version Pinning

This package strictly pins the following dependencies. Consumers do not need (and should not) install them separately:

| Package                        | Version   |
| ------------------------------ | --------- |
| `better-auth`                  | `1.6.20`  |
| `@better-auth/drizzle-adapter` | `1.6.20`  |
| `@better-auth/infra`           | `0.3.2`   |
| `drizzle-orm`                  | `^0.45.2` |

---

## Export Paths

```
@zntr/auth         → main entry (all exports)
@zntr/auth/server  → server-side factory createAuth
@zntr/auth/client  → client-side factory createAuthClient + plugins
@zntr/auth/schema  → auth table drizzle schema definitions
@zntr/auth/adapter → createDrizzleAdapter factory
@zntr/auth/types   → all TypeScript types
```

### Why Split Paths?

The server-side code (`createAuth`) depends on Better Auth's server plugins, which cannot run in a browser. The client-side code (`createAuthClient`) depends on `better-auth/react`. Split paths prevent server code from leaking into client bundles.

**Correct usage:**

```ts
// Server-side file (e.g. lib/auth.ts)
import { createAuth } from '@zntr/auth/server'

// Client-side file (e.g. lib/auth/client.ts)
import { createAuthClient } from '@zntr/auth/client'

// Types (available on both sides)
import type { CreateAuthOptions } from '@zntr/auth/types'
```

**Not recommended but works:**

```ts
// Imports everything from the main entry, which may pull server code into the client
import { createAuth } from '@zntr/auth'
```

---

## Quick Start

### 1. Server Configuration

Create `lib/auth.ts` in your app:

```ts
import { createAuth } from '@zntr/auth/server'
import { getDb } from '@/lib/drizzle/client'
import bcrypt from 'bcryptjs'

const baseURL = process.env.NEXT_PUBLIC_BASE_URL

const { auth, enabledPlugins } = createAuth({
  db: getDb(),
  // baseURL is optional — when omitted, Better Auth infers it from the request
  ...(baseURL ? { baseURL } : {}),
  // trustedOrigins is required — used for CORS and cookie validation
  trustedOrigins: baseURL ? [baseURL] : [],
  // password is required — password hash and verify functions
  password: {
    hash: async (password: string) => bcrypt.hash(password, 10),
    verify: async ({ hash, password }) => bcrypt.compare(password, hash),
  },
  // emailCallbacks is required — email sending logic
  emailCallbacks: {
    sendResetPassword: async ({ user, url }) => {
      /* send reset password email */
    },
    sendVerificationEmail: async ({ user, url }) => {
      /* send verification email */
    },
    sendChangeEmailVerification: async ({ user, newEmail, url }) => {
      /* optional */
    },
    sendVerificationOTP: async ({ email, otp, type }) => {
      /* optional, required when emailOTP plugin is enabled */
    },
  },
  // plugins is optional — built-in plugin configuration
  plugins: {
    twoFactor: { issuer: 'Your App' },
    sentinel: {
      apiKey: process.env.BETTER_AUTH_API_KEY,
      security: {
        credentialStuffing: { enabled: true },
        compromisedPassword: { enabled: true },
        botBlocking: { action: 'challenge' },
        emailValidation: { enabled: true },
      },
    },
    emailOTP: { changeEmail: { enabled: true } },
  },
  // isDev is optional — enables console.warn in development mode
  isDev: process.env.NODE_ENV !== 'production',
})

export { auth, enabledPlugins }
```

### 2. Client Configuration

Create `lib/auth/client.ts`:

```ts
'use client'

import {
  createAuthClient,
  emailOTPClient,
  twoFactorClient,
  sentinelClient,
} from '@zntr/auth/client'
import { enabledPlugins } from '@/lib/auth'

const baseURL = process.env.NEXT_PUBLIC_APP_URL

export const authClient = createAuthClient({
  ...(baseURL ? { baseURL } : {}),
  // Dynamically load client plugins based on what the server enabled
  plugins: [
    ...(enabledPlugins.twoFactor ? [twoFactorClient()] : []),
    ...(enabledPlugins.sentinel
      ? [sentinelClient({ autoSolveChallenge: true })]
      : []),
    ...(enabledPlugins.emailOTP ? [emailOTPClient()] : []),
  ],
})
```

### 3. API Route (Next.js App Router)

Create `app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from '@zntr/auth'
import { auth } from '@/lib/auth'

export const { GET, POST } = toNextJsHandler(auth)
```

### 4. Middleware (Optional)

```ts
import { getSessionCookie } from '@zntr/auth'

// Use getSessionCookie in your middleware to check auth status
const sessionCookie = getSessionCookie(request)
```

---

## API Reference

### createAuth(options)

Creates a Better Auth server instance.

**Parameters:**

| Parameter          | Type                  | Required | Description                                                 |
| ------------------ | --------------------- | -------- | ----------------------------------------------------------- |
| `db`               | `PgDatabase`          | ✅       | Drizzle ORM database instance                               |
| `baseURL`          | `string`              | ❌       | App base URL; inferred from request if omitted              |
| `trustedOrigins`   | `string[]`            | ✅       | Trusted origin domains for CORS and cookie validation       |
| `emailCallbacks`   | `EmailCallbacks`      | ✅       | Email sending callbacks (see below)                         |
| `plugins`          | `PluginOptions`       | ❌       | Built-in plugin configuration                               |
| `password`         | `PasswordHashOptions` | ✅       | Password hash/verify functions                              |
| `secret`           | `string`              | ❌       | Auth secret; defaults to `BETTER_AUTH_SECRET` env var       |
| `disableCsrfCheck` | `boolean`             | ❌       | Disable CSRF check, defaults to `false`                     |
| `isDev`            | `boolean`             | ❌       | Development mode; enables console.warn, defaults to `false` |

**Return value:**

```ts
{
  auth: AuthInstance      // Better Auth instance for API routes and server-side calls
  enabledPlugins: {       // Enabled plugins, pass to client
    twoFactor?: boolean
    sentinel?: boolean
    emailOTP?: boolean
  }
}
```

**EmailCallbacks:**

| Callback                      | Required | Description                                                            |
| ----------------------------- | -------- | ---------------------------------------------------------------------- |
| `sendResetPassword`           | ✅       | Send password reset email                                              |
| `sendVerificationEmail`       | ✅       | Send email verification                                                |
| `sendChangeEmailVerification` | ❌       | Send email change verification                                         |
| `sendVerificationOTP`         | ❌       | Send OTP code (strongly recommended when `emailOTP` plugin is enabled) |

**PluginOptions:**

All plugins support `true` (enable with defaults), `false`/`undefined` (disable), or an object (enable with overrides):

```ts
type PluginOptions = {
  twoFactor?: boolean | { issuer?: string; otpLength?: number }
  sentinel?: boolean | SentinelOptions
  emailOTP?:
    | boolean
    | {
        changeEmail?: { enabled: boolean }
        otpLength?: number
        expiresIn?: number
      }
}
```

### createAuthClient(options)

Creates a Better Auth client instance.

**Parameters:**

| Parameter | Type                       | Required | Description         |
| --------- | -------------------------- | -------- | ------------------- |
| `baseURL` | `string`                   | ❌       | API base URL        |
| `plugins` | `BetterAuthClientPlugin[]` | ❌       | Client plugin array |

> **Note:** You don't need to pass `enabledPlugins` directly. Instead, dynamically build the `plugins` array based on `enabledPlugins` values (see example above).

### createDrizzleAdapter(db, options?)

Creates a Drizzle ORM adapter.

**Parameters:**

| Parameter          | Type                          | Required | Description                       |
| ------------------ | ----------------------------- | -------- | --------------------------------- |
| `db`               | `PgDatabase`                  | ✅       | Drizzle ORM instance              |
| `options.provider` | `'pg' \| 'mysql' \| 'sqlite'` | ❌       | Database type, defaults to `'pg'` |
| `options.schema`   | `Partial<AuthSchema>`         | ❌       | Optional schema extension         |

> Usually you don't need to use this function directly — `createAuth` handles adapter creation internally.

---

## Schema

`@zntr/auth/schema` exports the following database table definitions:

| Table          | Description               |
| -------------- | ------------------------- |
| `user`         | User accounts             |
| `session`      | Active sessions           |
| `account`      | OAuth/social accounts     |
| `verification` | Email verification tokens |
| `twoFactor`    | Two-factor authentication |

There is also an `authSchema` object containing references to all tables, used by the Drizzle adapter.

### Schema Extension

If you need to add custom fields to the `user` table, extend it on the consumer side:

```ts
import { user as baseUser } from '@zntr/auth/schema'
// Note: extending the user table requires modifying Better Auth's additionalFields config
```

### Database Migrations

`@zntr/auth` provides schema definitions but **does not generate migration files**. Consumers must run:

```bash
# Generate migration
pnpm dlx drizzle-kit generate

# Apply to database
pnpm dlx drizzle-kit migrate
```

The consumer's `drizzle.config.ts` should point to the schema file containing all tables (auth + app tables):

```ts
// drizzle.config.ts
export default defineConfig({
  schema: './lib/drizzle/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL || process.env.DATABASE_URL!,
  },
})
```

The consumer's schema file should re-export auth tables and define app tables:

```ts
// lib/drizzle/schema.ts
import { pgTable, text } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Re-export auth tables
import {
  user,
  session,
  account,
  verification,
  twoFactor,
} from '@zntr/auth/schema'
export { user, session, account, verification, twoFactor }

// Define app tables
export const calendarEvents = pgTable('calendar_events', {
  /* ... */
})

// Define relations (between auth tables and app tables)
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  calendarEvents: many(calendarEvents),
  // ...
}))
```

---

## Environment Variables

`@zntr/auth` relies on the following environment variables (provided by the consumer):

| Variable                         | Required | Description                             |
| -------------------------------- | -------- | --------------------------------------- |
| `BETTER_AUTH_SECRET`             | ✅       | Auth secret for signing session cookies |
| `BETTER_AUTH_URL`                | ❌       | Better Auth service URL                 |
| `BETTER_AUTH_API_KEY`            | ❌       | Sentinel security plugin API key        |
| `POSTGRES_URL` or `DATABASE_URL` | ✅       | PostgreSQL connection string            |

---

## FAQ

### Q: How do I customize the password hashing algorithm?

Pass custom hash/verify functions via the `password` parameter:

```ts
createAuth({
  password: {
    hash: async (pw) => myCustomHash(pw),
    verify: async ({ hash, password }) => myCustomVerify(hash, password),
  },
  // ...
})
```

### Q: How do I disable a plugin?

Set it to `false` or omit it in the `plugins` object:

```ts
plugins: {
  twoFactor: false,        // disabled
  sentinel: true,          // enabled with defaults
  // emailOTP not mentioned = disabled
}
```

### Q: What happens if the server disables a plugin but the client still loads it?

**They must stay in sync.** The `enabledPlugins` returned by `createAuth` explicitly identifies which plugins the server has enabled. The client should dynamically load based on `enabledPlugins`. If the client loads a plugin that the server didn't enable, calling plugin methods will result in `undefined` errors.

### Q: What happens if I don't set `baseURL`?

Better Auth infers the URL from the current request's `Origin` header. This works in most cases but may produce unexpected URLs in email link generation (password reset, email verification). It's recommended to set `baseURL` explicitly.

### Q: How do I integrate custom email sending?

Pass your email sending logic via `emailCallbacks`. The function receives `{ user, url }` or `{ email, otp, type }` and you implement the sending:

```ts
emailCallbacks: {
  sendResetPassword: async ({ user, url }) => {
    await myEmailService.send({
      to: user.email,
      subject: 'Reset your password',
      body: `Click here: ${url}`,
    })
  },
  // ...
}
```

### Q: What's the difference between this package and using `better-auth` directly?

1. **Unified configuration** — all consumers use the same plugin combination and security config
2. **Type safety** — predefined types ensure correct configuration
3. **Centralized schema** — auth table definitions live in one place, consumers just re-export
4. **Version pinning** — prevents multiple consumers from using different better-auth versions

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Consumer App (e.g. one-calendar) │
│                                         │
│  lib/auth.ts    ← @zntr/auth/server     │
│  lib/auth/client.ts ← @zntr/auth/client │
│  lib/drizzle/schema.ts ← re-export      │
│  drizzle.config.ts ← consumer's own      │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│              @zntr/auth                 │
│                                         │
│  schema.ts    → auth table definitions   │
│  adapter.ts   → drizzle adapter factory  │
│  server.ts    → createAuth() factory     │
│  client.ts    → createAuthClient() + plugins │
│  types.ts     → all types                │
│  index.ts     → barrel export            │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         better-auth@1.6.20              │
│  + @better-auth/drizzle-adapter         │
│  + @better-auth/infra (sentinel)        │
└─────────────────────────────────────────┘
```

---

## Development

```bash
# Type check
pnpm --filter @zntr/auth type-check

# Lint
pnpm --filter @zntr/auth lint

# Build
pnpm --filter @zntr/auth build

# Test
pnpm --filter @zntr/auth test
```
