// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import {
  checkFixedWindowLimit,
  cleanupRateLimitCounters,
} from '@zntr/auth/rate-limit'
import { rateLimitSchema } from '@zntr/auth/rate-limit-table'
import {
  assertIsolated,
  connectIsolated,
  databaseIsAvailable,
  type Sql,
} from './db-harness'

/**
 * The counter is a real `INSERT ... ON CONFLICT`, so the properties worth
 * checking are properties of Postgres: that the upsert loses no updates under
 * concurrency, and that the migration and the drizzle table agree.
 *
 * A hand-written fake would encode our own assumption about what an upsert
 * returns — the exact assumption the Redis implementation got subtly wrong
 * (read-then-write across instances), which is the bug this replaced.
 */

const TABLE = 'rate_limit_counters'

let sql: Sql | null = null
let db: ReturnType<typeof drizzle<typeof rateLimitSchema>> | null = null

// Decided at collection time, because that is when `skipIf` reads it — `beforeAll`
// has not run yet, so a condition on `sql` here would skip unconditionally and
// these tests would never execute even with a database configured.
const available = databaseIsAvailable()

function setup(): { sql: Sql; db: NonNullable<typeof db> } {
  if (!sql || !db)
    throw new Error(
      'Rate-limit integration tests require AUTH_TEST_POSTGRES_URL',
    )
  return { sql, db }
}

beforeAll(async () => {
  sql = await connectIsolated()
  if (!sql) return

  // Applied from the migration itself rather than re-declared, so a column the
  // drizzle table expects but the migration never creates fails these tests.
  const migration = readFileSync(
    resolve(
      import.meta.dirname,
      '../../apps/calendar/drizzle/0023_rate_limit_counters.sql',
    ),
    'utf8',
  ).split('--> statement-breakpoint')

  const [existing] = await sql`select to_regclass(${TABLE}) as relation`
  if (existing?.relation) {
    await sql.end()
    sql = null
    throw new Error(`Rate-limit fixture requires an absent auth_test.${TABLE}`)
  }
  for (const statement of migration) await sql.unsafe(statement)

  db = drizzle({ client: sql.client, schema: rateLimitSchema })
})

afterAll(async () => {
  if (!sql) return
  await assertIsolated(sql)
  await sql.unsafe(`drop table if exists auth_test."${TABLE}"`)
  await sql.end()
})

const OPTS = { name: 'test', subject: 'a', limit: 3, windowSeconds: 60 }

/** Drops every counter, so one case cannot inherit another's window. */
async function reset() {
  const { sql } = setup()
  await assertIsolated(sql)
  await sql.unsafe(`truncate table auth_test.${TABLE}`)
}

describe.skipIf(!available)('checkFixedWindowLimit', () => {
  it('allows calls up to the limit and blocks the one past it', async () => {
    await reset()
    const { db } = setup()
    for (let i = 0; i < OPTS.limit; i++) {
      expect((await checkFixedWindowLimit(db, OPTS)).allowed).toBe(true)
    }
    expect((await checkFixedWindowLimit(db, OPTS)).allowed).toBe(false)
  })

  it('counts every concurrent increment, with none lost', async () => {
    await reset()
    const { db } = setup()

    // The point of the upsert. Twenty parallel calls on ONE connection
    // serialise at the protocol level, but the server-side statement is still
    // the one under test: if it were a SELECT followed by an UPDATE, every
    // statement would observe the same starting count and the final row would
    // read far below the number of increments.
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        checkFixedWindowLimit(db, { ...OPTS, limit: 1000 }),
      ),
    )

    const { sql } = setup()
    // A tagged template binds its values as parameters, which is right for
    // data and wrong for a table name — `from $1` is a syntax error. `unsafe`
    // is correct here because TABLE is a constant in this file, and the schema
    // is spelled out so the statement does not depend on the search path.
    const [row] = await sql.unsafe<{ count: number }[]>(
      `select count from auth_test.${TABLE}`,
    )
    expect(row?.count).toBe(20)
    expect(results.every((r) => r.allowed)).toBe(true)
    // A generous timeout, not a smaller workload. The harness pins the schema
    // with `set local` inside a transaction, and holding a transaction is what
    // pins the backend, so twenty calls on one connection cannot overlap: each
    // is three round trips (pin, statement, commit) at roughly half a second
    // each against a pooler an ocean away, which is close to twenty seconds on
    // its own. Reducing the count or the round trips would make the assertion
    // cheaper and the test weaker; the lost update it guards against needs
    // enough overlap to be a real contender for the row lock.
  }, 120_000)

  it('does not share a budget across subjects or names', async () => {
    await reset()
    const { db } = setup()
    for (let i = 0; i < OPTS.limit + 1; i++) {
      await checkFixedWindowLimit(db, { ...OPTS, subject: 'a' })
    }
    expect(
      (await checkFixedWindowLimit(db, { ...OPTS, subject: 'b' })).allowed,
    ).toBe(true)
    expect(
      (await checkFixedWindowLimit(db, { ...OPTS, name: 'other' })).allowed,
    ).toBe(true)
  })

  it('keeps budgets apart when a name or a subject contains the obvious separator', async () => {
    // The row is keyed by the three parts concatenated, so the separator has to
    // be a character the parts cannot contain. A colon is in real use on both
    // sides, which makes a colon key collide for a reason an attacker picks:
    // the auth route spends `auth:sign-in/email` per address AND
    // `auth:sign-in/email:global` over the subject `all`, while `clientIpFrom`
    // returns a request header verbatim. Under a colon key the two subjects
    // below are the same row, so one client that sends
    // `x-forwarded-for: global:all` spends the shared sign-in budget and locks
    // every other user out of signing in for the rest of the window.
    await reset()
    const { db } = setup()
    for (let i = 0; i < OPTS.limit + 1; i++) {
      await checkFixedWindowLimit(db, {
        ...OPTS,
        name: 'auth:sign-in/email',
        subject: 'all',
      })
    }
    expect(
      (
        await checkFixedWindowLimit(db, {
          ...OPTS,
          name: 'auth:sign-in/email:global',
          subject: 'all',
        })
      ).allowed,
    ).toBe(true)
    expect(
      (
        await checkFixedWindowLimit(db, {
          ...OPTS,
          name: 'auth:sign-in/email',
          subject: 'global:all',
        })
      ).allowed,
    ).toBe(true)
  })

  it('reports a retryAfter inside the current window', async () => {
    await reset()
    const { db } = setup()
    const result = await checkFixedWindowLimit(db, OPTS)
    expect(result.retryAfter).toBeGreaterThan(0)
    expect(result.retryAfter).toBeLessThanOrEqual(OPTS.windowSeconds)
  })

  it('keys the row by the window start, so a new window is a new row', async () => {
    await reset()
    const { sql } = setup()
    const { db } = setup()

    await checkFixedWindowLimit(db, OPTS)
    const first = await sql.unsafe<{ window_start: Date }[]>(
      `select window_start from auth_test.${TABLE}`,
    )
    expect(first).toHaveLength(1)

    // Two windows later the key differs, so the budget starts over rather than
    // inheriting the previous window's count.
    await sql.unsafe(
      `update auth_test.${TABLE} set window_start = window_start - interval '2 minutes'`,
    )
    expect((await checkFixedWindowLimit(db, OPTS)).allowed).toBe(true)
  })
})

// `available`, not `sql`: `skipIf` is read at collection time, before
// `beforeAll` has connected anything, so conditioning on `sql` here would skip
// unconditionally and leave the cleanup sweep untested on every machine.
describe.skipIf(!available)('cleanupRateLimitCounters', () => {
  it('deletes only rows whose window has closed', async () => {
    await reset()
    const { sql } = setup()
    const { db } = setup()

    await checkFixedWindowLimit(db, OPTS)
    // A row from a window long gone, which nothing would ever remove on its own.
    await sql.unsafe(
      `insert into auth_test.${TABLE} (bucket_key, window_start, count, expires_at) ` +
        `values ('stale:0', now() - interval '1 hour', 9, now() - interval '30 minutes')`,
    )

    expect(await cleanupRateLimitCounters(db)).toBe(1)
    const remaining = await sql.unsafe<{ bucket_key: string }[]>(
      `select bucket_key from auth_test.${TABLE}`,
    )
    expect(remaining.map((r) => r.bucket_key)).not.toContain('stale:0')
    expect(remaining).toHaveLength(1)
  })

  it('is a no-op when nothing has expired', async () => {
    await reset()
    const { db } = setup()
    await checkFixedWindowLimit(db, OPTS)
    expect(await cleanupRateLimitCounters(db)).toBe(0)
  })
})
