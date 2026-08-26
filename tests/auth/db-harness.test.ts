import { describe, it, expect, afterAll } from 'vitest'
import {
  TEST_SCHEMA,
  assertIsolated,
  connectIsolated,
  databaseIsAvailable,
  truncateOwn,
} from './db-harness'
import type { Sql } from 'postgres'

/**
 * The harness that protects real user data is itself the first thing tested.
 *
 * Plan 026 runs the OAuth token-endpoint tests against a real Postgres, and
 * that database holds 11 real users in `public`. Every guarantee those tests
 * rely on comes from this file, so an untested harness would mean the safety
 * property is assumed rather than checked.
 */
const available = databaseIsAvailable()

// Stated loudly rather than skipped quietly: a missing database must look like
// missing coverage, not like a passing suite.
if (!available) {
  console.warn(
    '[tests/auth] POSTGRES_URL not found in .env.local — database isolation ' +
      'tests are SKIPPED. Integration coverage for plan 026 Seam 2 is absent ' +
      'in this run.',
  )
}

let connection: Sql | null = null

afterAll(async () => {
  if (connection) await connection.end()
})

describe.skipIf(!available)('auth test database harness', () => {
  it('connects with the test schema as the current schema', async () => {
    connection = await connectIsolated()
    expect(connection).not.toBeNull()

    const [row] = await connection!<{ schema: string }[]>`
      select current_schema() as schema
    `
    expect(row?.schema).toBe(TEST_SCHEMA)
  })

  it('never resolves a user table outside the test schema', async () => {
    const sql = connection ?? (await connectIsolated())!
    // The property that matters: `search_path` excludes `public`, so an
    // unqualified reference cannot reach production. Asserted as "resolves to
    // nothing, or to the test schema" rather than "resolves to nothing" —
    // rehearsing a migration means creating a replica under the real name, and
    // that must stay distinguishable from seeing the real table.
    for (const table of ['user', 'session', 'account', 'verification']) {
      const [row] = await sql<{ resolved_schema: string | null }[]>`
        select n.nspname as resolved_schema
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where c.oid = to_regclass(${table})
      `
      const schema = row?.resolved_schema ?? null
      if (schema !== null) {
        expect(schema, table).toBe(TEST_SCHEMA)
      }
    }
  })

  it('reads real users only when they are explicitly schema-qualified', async () => {
    const sql = connection ?? (await connectIsolated())!
    // Proves the isolation is `search_path`, not a permissions boundary — worth
    // knowing, because it means a schema-qualified query in a test IS dangerous.
    // The forbidden-table check exists precisely because unqualified names are
    // the realistic mistake.
    const [row] = await sql<{ count: number }[]>`
      select count(*)::int as count from public."user"
    `
    expect(row!.count).toBeGreaterThan(0)
  })

  it('rejects a connection whose search_path exposes public', async () => {
    // The exact misconfiguration `assertIsolated` exists to catch: a
    // `search_path` of `auth_test, public` sets `current_schema` correctly while
    // leaving every real table one unqualified select away.
    //
    // Caught by inspecting the path itself rather than by probing table names.
    // Once this schema holds its own `account` replica, a name probe resolves
    // `account` to the replica and the leak goes undetected — which is exactly
    // the blind spot this rehearsal exposed.
    const postgres = (await import('postgres')).default
    const fs = await import('node:fs')
    const path = await import('node:path')
    const contents = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../.env.local'),
      'utf8',
    )
    const url = contents.match(/^POSTGRES_URL="?([^"\n]+)"?/m)![1]!

    const leaky = postgres(url, {
      ssl: 'require',
      max: 1,
      connection: { search_path: `${TEST_SCHEMA}, public` },
      connect_timeout: 20,
    })
    try {
      await expect(assertIsolated(leaky)).rejects.toThrow(
        /search_path exposes public/,
      )
    } finally {
      await leaky.end()
    }
  })

  it('rejects a connection pointed at public', async () => {
    const postgres = (await import('postgres')).default
    const fs = await import('node:fs')
    const path = await import('node:path')
    const contents = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../.env.local'),
      'utf8',
    )
    const url = contents.match(/^POSTGRES_URL="?([^"\n]+)"?/m)![1]!

    const wrong = postgres(url, { ssl: 'require', max: 1, connect_timeout: 20 })
    try {
      await expect(assertIsolated(wrong)).rejects.toThrow(/not isolated/)
    } finally {
      await wrong.end()
    }
  })

  it('empties a table it owns, leaving real data intact', async () => {
    const sql = connection ?? (await connectIsolated())!

    // Scoped to one table this test owns rather than `truncateAll`. Suites run
    // in parallel against one schema, so a whole-schema truncate would delete
    // another suite's fixtures mid-run — the sort of cross-test coupling that
    // produces failures with no relation to the code under test.
    await sql`create table if not exists harness_probe (id text primary key)`
    await sql`
      insert into harness_probe (id) values ('one') on conflict do nothing
    `

    const [before] = await sql<{ count: number }[]>`
      select count(*)::int as count from public."user"
    `
    await truncateOwn(sql, 'harness_probe')
    const [after] = await sql<{ count: number }[]>`
      select count(*)::int as count from public."user"
    `

    const [probe] = await sql<{ count: number }[]>`
      select count(*)::int as count from harness_probe
    `
    expect(probe!.count).toBe(0)
    // The load-bearing assertion: truncation did not reach production.
    expect(after!.count).toBe(before!.count)

    await sql`drop table if exists harness_probe`
  })
})
