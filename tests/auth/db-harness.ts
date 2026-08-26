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
 * Three independent checks, because each alone is insufficient:
 *
 * 1. `current_schema()` is the test schema — proves writes land there.
 * 2. The effective `search_path` names ONLY the test schema — proves nothing
 *    else is reachable unqualified, whatever this schema happens to contain.
 * 3. No forbidden table name resolves outside the test schema — a direct check
 *    on the property we actually care about.
 *
 * Check 2 is the load-bearing one, and it has to be separate from check 3. Once
 * this schema holds its own `account` replica (which is how a migration gets
 * rehearsed), a `search_path` of `auth_test, public` resolves `account` to the
 * replica — so check 3 passes while every OTHER real table is still one
 * unqualified `select` away. Inspecting the path itself does not have that blind
 * spot.
 *
 * Check 3 compares the resolved relation's SCHEMA rather than merely whether the
 * name resolves, so a legitimate replica is not mistaken for the real table.
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

  const [path] = await sql<{ search_path: string }[]>`
    show search_path
  `
  const entries = (path?.search_path ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/^"|"$/g, ''))
    .filter((entry) => entry.length > 0)
  const unexpected = entries.filter((entry) => entry !== TEST_SCHEMA)
  if (unexpected.length > 0) {
    throw new Error(
      `auth test harness search_path exposes ${unexpected.join(', ')}; ` +
        `it must name only ${TEST_SCHEMA}`,
    )
  }

  for (const table of FORBIDDEN_TABLES) {
    const [resolved] = await sql<{ resolved_schema: string | null }[]>`
      select n.nspname as resolved_schema
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.oid = to_regclass(${table})
    `
    const schemaName = resolved?.resolved_schema ?? null
    if (schemaName !== null && schemaName !== TEST_SCHEMA) {
      throw new Error(
        `auth test harness resolves "${table}" to schema "${schemaName}"; ` +
          `search_path must expose only ${TEST_SCHEMA}`,
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
 * Empties one named table the caller owns.
 *
 * Deliberately NOT a whole-schema truncate. Suites run in parallel against a
 * single schema, so emptying everything would delete another suite's fixtures
 * mid-run and produce failures unrelated to the code under test.
 *
 * Re-asserts isolation first, and rejects a qualified name. Truncation is the
 * one operation where a misconfigured connection is catastrophic rather than
 * merely wrong, so the check is repeated here rather than trusted from setup,
 * and a caller cannot reach outside the test schema by passing `public.user`.
 */
export async function truncateOwn(sql: Sql, table: string): Promise<void> {
  await assertIsolated(sql)

  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) {
    throw new Error(
      `refusing to truncate "${table}": pass a bare table name in ${TEST_SCHEMA}`,
    )
  }

  await sql.unsafe(`truncate table ${TEST_SCHEMA}."${table}" cascade`)
}
