import { describe, it, expect, afterAll } from 'vitest'
import {
  TEST_SCHEMA,
  assertIsolated,
  connectIsolated,
  databaseIsAvailable,
  truncateAll,
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

  it('cannot resolve the real user table', async () => {
    const sql = connection ?? (await connectIsolated())!
    // The property that matters. `search_path` excludes `public`, so an
    // unqualified reference to a production table resolves to nothing.
    const [row] = await sql<{ oid: number | null }[]>`
      select to_regclass('user') as oid
    `
    expect(row?.oid).toBeNull()
  })

  it('cannot resolve the real session or account tables', async () => {
    const sql = connection ?? (await connectIsolated())!
    for (const table of ['session', 'account', 'verification']) {
      const [row] = await sql<{ oid: number | null }[]>`
        select to_regclass(${table}) as oid
      `
      expect(row?.oid, table).toBeNull()
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
      await expect(assertIsolated(leaky)).rejects.toThrow(/can resolve/)
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

  it('truncates only the test schema, leaving real data intact', async () => {
    const sql = connection ?? (await connectIsolated())!

    await sql`create table if not exists probe (id text primary key)`
    await sql`insert into probe (id) values ('one') on conflict do nothing`

    const before = await sql<{ count: number }[]>`
      select count(*)::int as count from public."user"
    `
    await truncateAll(sql)
    const after = await sql<{ count: number }[]>`
      select count(*)::int as count from public."user"
    `

    const [probe] = await sql<{ count: number }[]>`
      select count(*)::int as count from probe
    `
    expect(probe!.count).toBe(0)
    // The load-bearing assertion: truncation did not reach production.
    expect(after![0]?.count ?? after[0]!.count).toBe(before[0]!.count)

    await sql`drop table if exists probe`
  })
})
