import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Fixed-window rate-limit counters.
 *
 * Lives in `@zntr/auth` rather than in either app because both apps rate-limit
 * against this one table: they share a single database (ADR-0017) and are
 * forbidden from importing each other, so a second copy of the definition in
 * either app is a definition that will eventually drift from the migration.
 *
 * The primary key IS the unit of atomicity. `checkFixedWindowLimit` relies on
 * `INSERT ... ON CONFLICT` to serialise concurrent increments on this row —
 * with a surrogate id and a unique constraint elsewhere the upsert would still
 * be correct, but the constraint would have to be declared in two places and
 * could be dropped without any query failing.
 *
 * Rows outlive their window. Nothing expires them; `cleanupRateLimitCounters`
 * does, from the calendar's maintenance cron.
 */
export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    /** `${name}|${subject}|${windowStartSeconds}` — see `bucketKey` in rate-limit.ts. */
    bucketKey: text('bucket_key').primaryKey(),
    windowStart: timestamp('window_start', {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    count: integer('count').default(0).notNull(),
    /** Two windows past `windowStart`; the cleanup job deletes past this. */
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      precision: 3,
    }).notNull(),
  },
  (table) => [index('idx_rate_limit_counters_expires_at').on(table.expiresAt)],
)

export const rateLimitSchema = { rateLimitCounters }
