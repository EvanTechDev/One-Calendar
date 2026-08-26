import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import type { Sql } from 'postgres'

/**
 * A real Postgres connection for the auth integration tests, pinned to an
 * isolated schema.
 *
 * Plan 026 Seam 2 needs a real database rather than a fake: the tests exist to
 * check OAuth protocol conformance, and a hand-written fake would encode our
 * assumptions instead of the server's behaviour — which is precisely the thing
 * under test.
 *
 * The project database also holds real users in `public`. So isolation is not
 * hygiene here, it is the safety property: every helper below refuses to run
 * until it has proved the connection cannot see `public`. A harness that could
 * reach `public` is a defect in the harness, not an inconvenience.
 */

/** The only schema these tests may touch. */
export const TEST_SCHEMA = 'auth_test'

/** Tables that must never be visible to a test connection. */
const FORBIDDEN_TABLES = ['user', 'session', 'account', 'verification']

function readDatabaseUrl(): string | null {
  // Read from .env.local rather than process.env: vitest does not load it, and
  // an explicitly-passed env var is the documented override.
  if (process.env.AUTH_TEST_POSTGRES_URL) {
    return process.env.AUTH_TEST_POSTGRES_URL
  }
  const envPath = path.resolve(import.meta.dirname, '../../.env.local')
  if (!fs.existsSync(envPath)) return null
  const contents = fs.readFileSync(envPath, 'utf8')
  const match = contents.match(/^POSTGRES_URL="?([^"\n]+)"?/m)
  return match ? match[1]! : null
}

/**
 * Whether these tests can run at all.
 *
 * Reported rather than thrown so a contributor without database access sees
 * skipped integration tests instead of a wall of failures — but never so that a
 * missing database silently reduces coverage to nothing. The suite states the
 * skip loudly.
 */
export function databaseIsAvailable(): boolean {
  return readDatabaseUrl() !== null
}

/**
 * Asserts a connection is confined to the test schema.
 *
 * Two independent checks, because either alone is insufficient:
 *
 * 1. `current_schema()` is the test schema — proves writes land there.
 * 2. The real user tables are not resolvable — proves an unqualified query
 *    cannot reach production data even if `search_path` were wrong.
 *
 * The second is the one that matters. A `search_path` of
 * `auth_test, public` would pass the first check while leaving every real user
 * table one unqualified `select` away.
 */
export async function assertIsolated(sql: Sql): Promise<void> {
  const [schema] = await sql<{ current_schema: string | null }[]>`
    select current_schema() as current_schema
  `
  if (schema?.current_schema !== TEST_SCHEMA) {
    throw new Error(
      `auth test harness is not isolated: current_schema is ${
        schema?.current_schema ?? 'null'
      }, expected ${TEST_SCHEMA}`,
    )
  }

  for (const table of FORBIDDEN_TABLES) {
    const [resolved] = await sql<{ oid: number | null }[]>`
      select to_regclass(${table}) as oid
    `
    if (resolved?.oid !== null) {
      throw new Error(
        `auth test harness can resolve the real "${table}" table; ` +
          'search_path must expose only ' +
          TEST_SCHEMA,
      )
    }
  }
}

/**
 * Opens an isolated connection, or returns null when no database is configured.
 *
 * `search_path` is set to the test schema ALONE — deliberately excluding
 * `public`, which is why the forbidden-table check above can pass.
 */
export async function connectIsolated(): Promise<Sql | null> {
  const url = readDatabaseUrl()
  if (!url) return null

  const sql = postgres(url, {
    ssl: 'require',
    max: 1,
    // Excluding `public` is the isolation. Postgres resolves unqualified names
    // against this list only, so a stray query fails rather than finding a real
    // table.
    connection: { search_path: TEST_SCHEMA },
    // Integration tests should fail fast rather than hang a suite.
    connect_timeout: 20,
  })

  try {
    await assertIsolated(sql)
  } catch (error) {
    await sql.end()
    throw error
  }

  return sql
}

/**
 * Empties the test schema between tests.
 *
 * Re-asserts isolation first. Truncation is the one operation where a
 * misconfigured connection would be catastrophic rather than merely wrong, so
 * the check is repeated at the call site rather than trusted from setup.
 */
export async function truncateAll(sql: Sql): Promise<void> {
  await assertIsolated(sql)

  const tables = await sql<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = ${TEST_SCHEMA}
  `
  if (tables.length === 0) return

  const names = tables.map((row) => `${TEST_SCHEMA}."${row.tablename}"`)
  await sql.unsafe(`truncate table ${names.join(', ')} cascade`)
}
