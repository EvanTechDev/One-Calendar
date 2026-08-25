import type { drizzle } from 'drizzle-orm/postgres-js'

/**
 * Any drizzle postgres-js handle, or a transaction executor derived from one.
 *
 * The operations here are connection-agnostic: each app passes its own client,
 * and the calendar passes a transaction so a meeting cascade commits atomically
 * with the event deletion that caused it. Mirrors the pattern already used in
 * apps/calendar/lib/invites/split-carry.ts.
 *
 * This is deliberately the loose `drizzle` return type rather than a schema-
 * bound one: the two apps instantiate drizzle with different schemas (each
 * app's own tables plus these), so a schema-parameterised type would not
 * accept both.
 */
type Database = ReturnType<typeof drizzle>

export type Db =
  | Database
  | Parameters<Parameters<Database['transaction']>[0]>[0]
