// @vitest-environment node
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createAuthPortal } from '../../packages/auth/src/portal'
import { databaseIsAvailable } from './db-harness'

/**
 * Plan 026 Seam 2: the OAuth token endpoint, over HTTP, against a real Postgres.
 *
 * Every assertion here is a security property, and each one is the reason the
 * protocol has the step it has. A fake database was rejected for this seam
 * deliberately: these tests exist to check the *server's* conformance, and a
 * hand-written fake would encode our assumptions about it instead — which is
 * precisely the thing under test.
 *
 * Isolation: the portal is pointed at the `auth_test` schema, so every row it
 * writes (clients, codes, tokens, and the users it needs) lands there. The
 * production tables in `public` are unreachable from this connection — see
 * db-harness for why that is asserted rather than assumed.
 */
const available = databaseIsAvailable()

if (!available) {
  console.warn(
    '[tests/auth] POSTGRES_URL not found — the token endpoint tests are ' +
      'SKIPPED. Plan 026 Seam 2 is unverified in this run.',
  )
}

const ISSUER = 'https://auth.test.local'
const REDIRECT_URI = 'https://cal.test.local/api/auth/callback/zentra'
const OTHER_REDIRECT = 'https://cal.test.local/api/auth/callback/other'

const DB_TIMEOUT = 60_000

/** The test user's password. Hashing is identity in this portal (see below). */
const PASSWORD = 'a-test-password-value'

// Creating 13 tables across a continent is slow; the setup pays for all of it
// once. Scoped to this file rather than raised globally.
const SETUP_TIMEOUT = 180_000

function readDatabaseUrl(): string {
  const envPath = path.resolve(import.meta.dirname, '../../.env.local')
  const contents = fs.readFileSync(envPath, 'utf8')
  return contents.match(/^POSTGRES_URL="?([^"\n]+)"?/m)![1]!
}

/** S256 PKCE, as the spec requires — `plain` is a vulnerability, not an option. */
function pkce() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

let portal: ReturnType<typeof createAuthPortal> | null = null
let sql: Awaited<ReturnType<typeof openSql>> | null = null
let clientId = ''
let clientSecret = ''
let userId = ''
let sessionCookie = ''

async function openSql() {
  const postgres = (await import('postgres')).default
  return postgres(readDatabaseUrl(), {
    ssl: 'require',
    max: 2,
    connection: { search_path: 'auth_test' },
    connect_timeout: 20,
  })
}

/**
 * The auth tables, in the test schema.
 *
 * Created here rather than reused from `public`: writing OAuth clients and
 * tokens next to 11 real users' rows is exactly what the harness exists to
 * prevent.
 */
async function createSchema(db: Awaited<ReturnType<typeof openSql>>) {
  const migrations = [
    'apps/calendar/drizzle/0017_oauth_provider_tables.sql',
  ].map((file) => path.resolve(import.meta.dirname, '../../', file))

  await db.unsafe(`
    create table if not exists "user" (
      id text primary key,
      name text not null,
      email text unique not null,
      "emailVerified" boolean not null default false,
      image text,
      "twoFactorEnabled" boolean,
      "createdAt" timestamp(3) with time zone not null default now(),
      "updatedAt" timestamp(3) with time zone not null default now()
    );
    create table if not exists "session" (
      id text primary key,
      "expiresAt" timestamp(3) with time zone not null,
      token text unique not null,
      "createdAt" timestamp(3) with time zone not null default now(),
      "updatedAt" timestamp(3) with time zone not null default now(),
      "ipAddress" text,
      "userAgent" text,
      "userId" text not null references "user"(id) on delete cascade
    );
    create table if not exists "account" (
      id text primary key,
      issuer text not null,
      "accountId" text not null,
      "providerId" text not null,
      "userId" text not null references "user"(id) on delete cascade,
      "accessToken" text, "refreshToken" text, "idToken" text,
      "accessTokenExpiresAt" timestamp(3) with time zone,
      "refreshTokenExpiresAt" timestamp(3) with time zone,
      scope text, password text,
      "createdAt" timestamp(3) with time zone not null default now(),
      "updatedAt" timestamp(3) with time zone not null default now()
    );
    create table if not exists "verification" (
      id text primary key,
      identifier text not null,
      value text not null,
      "expiresAt" timestamp(3) with time zone not null,
      "createdAt" timestamp(3) with time zone,
      "updatedAt" timestamp(3) with time zone
    );
    create table if not exists "two_factor" (
      id text primary key,
      secret text not null,
      "backupCodes" text not null,
      verified boolean not null default false,
      "failedVerificationCount" integer not null default 0,
      "lockedUntil" timestamp(3) with time zone,
      "userId" text unique not null references "user"(id) on delete cascade
    );
  `)

  for (const file of migrations) {
    const statements = fs
      .readFileSync(file, 'utf8')
      .split('--> statement-breakpoint')
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0)
    for (const statement of statements) {
      await db.unsafe(statement)
    }
  }
}

/** Posts a form-encoded token request, the way a real client does. */
async function postToken(
  body: Record<string, string>,
  auth?: { id: string; secret: string },
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  }
  if (auth) {
    headers.authorization = `Basic ${Buffer.from(
      `${auth.id}:${auth.secret}`,
    ).toString('base64')}`
  }
  const response = await portal!.auth.handler(
    new Request(`${ISSUER}/api/auth/oauth2/token`, {
      method: 'POST',
      headers,
      body: new URLSearchParams(body).toString(),
    }),
  )
  const text = await response.text()
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
  }
}

/**
 * Drives the real `/oauth2/authorize` endpoint to obtain a code.
 *
 * Deliberately NOT a hand-written verification row. The first attempt forged
 * one, which taught two things worth keeping: the stored identifier is a
 * **hash** of the code, not the code, and the PKCE challenge lives inside a
 * nested `query` object. A forged row therefore tests our idea of the format
 * rather than the server's -- and would have passed while proving nothing.
 *
 * A session cookie is minted through the portal so authorize has a signed-in
 * user to attribute the code to; the client has `skipConsent`, so no rendered
 * page is involved.
 */
async function issueCode(challenge: string, redirectUri = REDIRECT_URI) {
  const response = await portal!.auth.handler(
    new Request(
      `${ISSUER}/api/auth/oauth2/authorize?` +
        new URLSearchParams({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: 'openid profile email',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state: randomBytes(8).toString('hex'),
        }).toString(),
      { headers: { cookie: sessionCookie, origin: 'https://cal.test.local' } },
    ),
  )

  const location = response.headers.get('location')
  if (!location) {
    throw new Error(
      `authorize did not redirect (status ${response.status}): ${await response.text()}`,
    )
  }
  const code = new URL(location).searchParams.get('code')
  if (!code) throw new Error(`no code in redirect: ${location}`)
  return code
}

beforeAll(async () => {
  if (!available) return
  sql = await openSql()
  await createSchema(sql)

  // A verified user for the code to belong to.
  userId = `u-${randomBytes(8).toString('hex')}`
  await sql`
    insert into "user" (id, name, email, "emailVerified")
    values (${userId}, 'Test User', ${`${userId}@test.local`}, true)
  `

  portal = createAuthPortal({
    db: (await import('drizzle-orm/postgres-js')).drizzle(sql, {
      schema: {
        ...(await import('../../packages/auth/src/schema')).authSchema,
        ...(await import('../../packages/auth/src/schema')).oauthProviderSchema,
      },
    }) as never,
    secret: 'a-test-portal-secret-long-enough-for-hs256',
    baseURL: `${ISSUER}/api/auth`,
    trustedOrigins: ['https://cal.test.local'],
    password: {
      hash: async (value: string) => value,
      verify: async ({ hash, password }) => hash === password,
    },
    emailCallbacks: {
      sendResetPassword: async () => {},
      sendVerificationEmail: async () => {},
      sendVerificationOTP: async () => {},
    },
  })

  // A real session, obtained by signing in through the portal rather than by
  // writing a session row: authorize reads the cookie, and a hand-made row
  // would skip the signing the cookie carries.
  await sql`
    insert into account (id, issuer, "accountId", "providerId", "userId", password)
    values (
      ${randomBytes(12).toString('hex')}, 'local:credential',
      ${userId}, 'credential', ${userId}, ${PASSWORD}
    )
  `

  const signIn = await portal.auth.handler(
    new Request(`${ISSUER}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://cal.test.local',
      },
      body: JSON.stringify({
        email: `${userId}@test.local`,
        password: PASSWORD,
      }),
    }),
  )
  const setCookie = signIn.headers.get('set-cookie')
  if (!setCookie) {
    throw new Error(
      `sign-in returned no cookie (status ${signIn.status}): ${await signIn.text()}`,
    )
  }
  sessionCookie = setCookie
    .split(',')
    .map((part) => part.trim().split(';')[0])
    .filter((part) => part.includes('='))
    .join('; ')

  // Registered through the admin endpoint rather than by inserting a row.
  // The first attempt inserted one with a plaintext secret and every token
  // request returned `invalid_client` -- because the server stores the secret
  // hashed. Which is the right behaviour, and the reason a client secret cannot
  // be recovered from a database dump. Using the real registration path is how
  // the test stops encoding a wrong idea of the storage format.
  const created = await portal.auth.api.adminCreateOAuthClient({
    body: {
      client_name: 'Zentra Calendar (test)',
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: 'client_secret_basic',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'openid profile email offline_access',
      skip_consent: true,
    },
    headers: new Headers({ cookie: sessionCookie }),
  } as never)

  clientId = (created as any).client_id
  clientSecret = (created as any).client_secret
  if (!clientId || !clientSecret) {
    throw new Error(
      `client registration returned no credentials: ${JSON.stringify(created)}`,
    )
  }
}, SETUP_TIMEOUT)

afterAll(async () => {
  if (!sql) return
  for (const table of [
    'oauthAccessToken',
    'oauthRefreshToken',
    'oauthConsent',
    'oauthClientResource',
    'oauthClientAssertion',
    'oauthResource',
    'oauthClient',
    'jwks',
    'two_factor',
    'account',
    'verification',
    'session',
    'user',
  ]) {
    await sql.unsafe(`drop table if exists "${table}" cascade`)
  }
  await sql.end()
})

describe.skipIf(!available)('POST /oauth2/token', () => {
  it(
    'exchanges a valid code for a token',
    { timeout: DB_TIMEOUT },
    async () => {
      const { verifier, challenge } = pkce()
      const code = await issueCode(challenge)

      const { status, json } = await postToken(
        {
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: verifier,
          client_id: clientId,
        },
        { id: clientId, secret: clientSecret },
      )

      expect(status, JSON.stringify(json)).toBe(200)
      expect(json.access_token).toBeTruthy()
      expect(json.token_type?.toLowerCase()).toBe('bearer')
    },
  )

  it(
    'refuses to redeem the same code twice',
    { timeout: DB_TIMEOUT },
    async () => {
      // Replay protection. Without it, an authorization code captured from a
      // redirect (a referrer log, browser history, a shared screen) is a
      // reusable credential.
      const { verifier, challenge } = pkce()
      const code = await issueCode(challenge)
      const body = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
        client_id: clientId,
      }

      const first = await postToken(body, {
        id: clientId,
        secret: clientSecret,
      })
      expect(first.status).toBe(200)

      const second = await postToken(body, {
        id: clientId,
        secret: clientSecret,
      })
      expect(second.status).toBeGreaterThanOrEqual(400)
      expect(second.json.error).toBe('invalid_grant')
    },
  )

  it(
    'rejects a mismatched PKCE verifier',
    { timeout: DB_TIMEOUT },
    async () => {
      // This is what PKCE is for: an attacker holding the code but not the
      // verifier cannot redeem it.
      const { challenge } = pkce()
      const other = pkce()
      const code = await issueCode(challenge)

      const { status, json } = await postToken(
        {
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: other.verifier,
          client_id: clientId,
        },
        { id: clientId, secret: clientSecret },
      )

      expect(status).toBeGreaterThanOrEqual(400)
      // Either code is a correct refusal; the property is that a holder of the
      // code but not the verifier gets nothing. Asserting one exact string here
      // would pin a protocol detail rather than the security guarantee.
      expect(['invalid_grant', 'invalid_request']).toContain(json.error)
    },
  )

  it('rejects a missing PKCE verifier', { timeout: DB_TIMEOUT }, async () => {
    // Omitting the parameter must not be a way around the check.
    const { challenge } = pkce()
    const code = await issueCode(challenge)

    const { status } = await postToken(
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
      },
      { id: clientId, secret: clientSecret },
    )

    expect(status).toBeGreaterThanOrEqual(400)
  })

  it(
    'rejects a redirect_uri that is not an exact registered match',
    { timeout: DB_TIMEOUT },
    async () => {
      // Exact matching stops an open-redirect on the client from becoming a code
      // exfiltration channel.
      const { verifier, challenge } = pkce()
      const code = await issueCode(challenge)

      const { status, json } = await postToken(
        {
          grant_type: 'authorization_code',
          code,
          redirect_uri: OTHER_REDIRECT,
          code_verifier: verifier,
          client_id: clientId,
        },
        { id: clientId, secret: clientSecret },
      )

      expect(status).toBeGreaterThanOrEqual(400)
      expect(json.error).toBe('invalid_grant')
    },
  )

  it(
    'stores the authorization code hashed, not in clear text',
    { timeout: DB_TIMEOUT },
    async () => {
      // A verification table readable by a backup, a log drain, or a support
      // query must not hand over usable codes. Found by inspecting the plugin
      // after a forged row failed to redeem -- worth pinning now that it is
      // known, because losing it would be invisible.
      const { challenge } = pkce()
      const code = await issueCode(challenge)

      const rows = await sql!`
        select identifier from verification where identifier = ${code}
      `
      expect(rows).toHaveLength(0)

      // And the row does exist, under some other identifier -- so the check
      // above is about hashing rather than about the row being absent.
      const all = await sql!`
        select count(*)::int as count from verification
      `
      expect(all[0]!.count).toBeGreaterThan(0)
    },
  )

  it(
    'rejects a confidential client that sends no credentials',
    { timeout: DB_TIMEOUT },
    async () => {
      // A registered `client_secret_basic` client must authenticate. Accepting
      // an unauthenticated request would make the secret decorative.
      const { verifier, challenge } = pkce()
      const code = await issueCode(challenge)

      const { status, json } = await postToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
        client_id: clientId,
      })

      expect(status).toBeGreaterThanOrEqual(400)
      expect(json.error).toBe('invalid_client')
    },
  )

  it('rejects a wrong client secret', { timeout: DB_TIMEOUT }, async () => {
    const { verifier, challenge } = pkce()
    const code = await issueCode(challenge)

    const { status, json } = await postToken(
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
        client_id: clientId,
      },
      { id: clientId, secret: 'not-the-secret' },
    )

    expect(status).toBeGreaterThanOrEqual(400)
    expect(json.error).toBe('invalid_client')
  })

  it('refuses an unknown grant type', { timeout: DB_TIMEOUT }, async () => {
    const { status } = await postToken(
      { grant_type: 'password', username: 'a', password: 'b' },
      { id: clientId, secret: clientSecret },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })
})
