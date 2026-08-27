// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'

/**
 * Lives in the calendar's suite rather than the auth package's, because it
 * builds the CALENDAR's instance: that requires the app's own `@/` alias and its
 * environment. Verifying an app's runtime contract belongs with the app.
 */
function databaseIsAvailable(): boolean {
  const envPath = path.resolve(import.meta.dirname, '../../../.env.local')
  if (!fs.existsSync(envPath)) return false
  return /^POSTGRES_URL=/m.test(fs.readFileSync(envPath, 'utf8'))
}

/**
 * Builds a real Better Auth instance against the real database and reads a
 * session through it.
 *
 * Type-checking clean says nothing about 1.7 working: the account identity
 * change is a runtime contract between the library's expected schema and the
 * actual columns. This is the cheapest check that the upgrade did not break the
 * one operation every page performs.
 *
 * Reads only — no user, session, or account row is created or modified. That is
 * what makes it safe to point at the live database, unlike the migration
 * rehearsal which uses an isolated replica.
 */
const available = databaseIsAvailable()

if (!available) {
  console.warn(
    '[tests/auth] POSTGRES_URL not found — the live Better Auth instance test ' +
      'is SKIPPED. The 1.7 runtime contract is unverified in this run.',
  )
}

beforeAll(() => {
  if (!available) return
  // The instance reads its configuration from the environment at construction,
  // and vitest does not load .env.local.
  const envPath = path.resolve(import.meta.dirname, '../../../.env.local')
  const contents = fs.readFileSync(envPath, 'utf8')
  for (const line of contents.split('\n')) {
    const match = line.match(/^([A-Z_0-9]+)="?([^"\n]*)"?$/)
    if (match && !process.env[match[1]!]) {
      process.env[match[1]!] = match[2]
    }
  }
  // Only needs to be present and stable for construction; no cookie issued here
  // is ever presented to a real app.
  process.env.BETTER_AUTH_SECRET ||= 'probe-secret-long-enough-for-hs256-0000'
  // This local integration target presents a self-signed chain. Production must
  // keep the verified default; the named opt-out exists for development probes.
  process.env.DATABASE_SSL = 'no-verify'
})

// Reaching a real Postgres in eu-north-1 does not fit the 5s default. Scoped to
// this file rather than raised globally, so a genuinely hung unit test elsewhere
// still fails fast.
const DB_TIMEOUT = 30_000

describe.skipIf(!available)('Better Auth 1.7 against the real schema', () => {
  it(
    'constructs an instance without a schema mismatch',
    { timeout: DB_TIMEOUT },
    async () => {
      const { auth } = await import('@/lib/auth/index')
      expect(auth).toBeDefined()
      expect(typeof auth.api.getSession).toBe('function')
    },
  )

  it(
    'reads a session for an anonymous request',
    { timeout: DB_TIMEOUT },
    async () => {
      // The operation every page performs. On 1.7 it touches `account` through the
      // adapter, so a missing or mistyped `issuer` column surfaces here rather
      // than in production.
      const { auth } = await import('@/lib/auth/index')
      const result = await auth.api.getSession({ headers: new Headers() })
      expect(result).toBeNull()
    },
  )

  it(
    'lists accounts for a real user without erroring on the new identity',
    { timeout: DB_TIMEOUT },
    async () => {
      // Exercises the account table specifically. 1.7 resolves identity by
      // (issuer, accountId); if the backfill were wrong this is where it shows.
      const { getDb } = await import('@/lib/drizzle/client')
      const db = getDb()
      const rows = await db.execute(
        `select issuer, "accountId", "userId" from account limit 5`,
      )
      const list = Array.isArray(rows) ? rows : ((rows as any).rows ?? [])
      expect(list.length).toBeGreaterThan(0)
      for (const row of list) {
        expect(row.issuer).toBe('local:credential')
        expect(row.accountId).toBe(row.userId)
      }
    },
  )
})
