import { lt, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { rateLimitCounters } from './rate-limit-table'

/**
 * Any drizzle node-postgres handle, or a transaction executor derived from one.
 *
 * Deliberately schema-erased rather than schema-bound: the two apps
 * instantiate drizzle with different schemas (each app's own tables plus this
 * one), so a schema-parameterised type would not accept both.
 *
 * The erasure is `NodePgDatabase<Record<string, unknown>>`, NOT
 * `ReturnType<typeof drizzle>`. That return type resolves `TSchema` to its
 * default of `Record<string, never>`, which trips drizzle's own guard —
 * `query` becomes a `DrizzleTypeError` rather than the relational builder map
 * — so a real, schema-bound handle is not assignable to it and every call site
 * fails to type-check with the message that a database is "missing" the
 * transaction's properties. Widening the schema argument to `unknown` keeps
 * `query` real while still accepting every handle.
 */
type Database = NodePgDatabase<Record<string, unknown>>

export type Db =
  | Database
  | Parameters<Parameters<Database['transaction']>[0]>[0]

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the current window resets — for the Retry-After header. */
  retryAfter: number
}

/**
 * The primary key of a counter row.
 *
 * This is a concatenation, so the separator has to be a character the other
 * parts cannot contain — otherwise two different budgets address the same row
 * and one budget's traffic throttles a subject against a limit it never
 * touched. A colon is not usable, and not merely because budget names are
 * already composite (`auth:sign-in/email:global`): subjects are attacker-
 * controlled on the IP-keyed budgets, `clientIpFrom` returns a request header
 * verbatim, and a global budget spends the subject `all`. Under a colon key
 * `auth:sign-in/email` + `global:all` is the same row as
 * `auth:sign-in/email:global` + `all`, so one client that sends
 * `x-forwarded-for: global:all` spends the shared sign-in budget and locks
 * every other user out of signing in for the rest of the window. `|` appears in
 * no budget name (they are literal route segments), no user id and no address.
 *
 * If a caller ever introduces a `|` into a name or a subject, this is the line
 * that has to change.
 */
function bucketKey(name: string, subject: string, windowStartSeconds: number) {
  return `${name}|${subject}|${windowStartSeconds}`
}

/**
 * Fixed-window counter, one row per (name, subject, window).
 *
 * The increment is a single `INSERT ... ON CONFLICT DO UPDATE SET count =
 * count + 1 RETURNING count`, not a SELECT followed by an UPDATE. That is the
 * whole reason the counter lives in the database: read-then-write lets two
 * instances both see 4 against a limit of 5 and both let themselves through,
 * so the effective ceiling becomes the limit times the number of instances.
 * The upsert is atomic, so the count is correct across every instance.
 *
 * A fixed window permits up to 2x the limit across a window boundary. That is
 * accepted here: a sliding window costs more round trips than these endpoints
 * justify.
 */
export async function checkFixedWindowLimit(
  db: Db,
  options: {
    name: string
    subject: string
    limit: number
    windowSeconds: number
  },
): Promise<RateLimitResult> {
  const { name, subject, limit, windowSeconds } = options
  const nowSeconds = Math.floor(Date.now() / 1000)
  const windowStartSeconds = nowSeconds - (nowSeconds % windowSeconds)
  const retryAfter = windowStartSeconds + windowSeconds - nowSeconds

  const [row] = await db
    .insert(rateLimitCounters)
    .values({
      bucketKey: bucketKey(name, subject, windowStartSeconds),
      windowStart: new Date(windowStartSeconds * 1000),
      // This call is itself a request against the budget, so the row it creates
      // starts at one, not at the column default of zero. Leaving the default
      // in place makes every budget one request too generous: the first request
      // of a window lands on the INSERT branch, never the ON CONFLICT branch,
      // so nothing increments it.
      count: 1,
      // Two windows of slack, so a row is still readable for a window after it
      // stopped accepting increments.
      expiresAt: new Date((windowStartSeconds + windowSeconds * 2) * 1000),
    })
    .onConflictDoUpdate({
      target: rateLimitCounters.bucketKey,
      set: { count: sql`${rateLimitCounters.count} + 1` },
    })
    .returning({ count: rateLimitCounters.count })

  return { allowed: (row?.count ?? 0) <= limit, retryAfter }
}

/**
 * Drops counters whose window has closed.
 *
 * Nothing expires a row by itself, so without this the table grows by one row
 * per (name, subject, window) forever. Returns how many were removed.
 */
export async function cleanupRateLimitCounters(db: Db): Promise<number> {
  const deleted = await db
    .delete(rateLimitCounters)
    .where(lt(rateLimitCounters.expiresAt, new Date()))
    .returning({ bucketKey: rateLimitCounters.bucketKey })
  return deleted.length
}
