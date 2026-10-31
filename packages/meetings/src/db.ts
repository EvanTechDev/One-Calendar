import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

/**
 * Any drizzle node-postgres handle, or a transaction executor derived from one.
 *
 * The operations here are connection-agnostic: each app passes its own client,
 * and the calendar passes a transaction so a meeting cascade commits atomically
 * with the event deletion that caused it. Mirrors the pattern already used in
 * apps/calendar/lib/invites/split-carry.ts.
 *
 * This is deliberately schema-erased rather than schema-bound one: the two apps
 * instantiate drizzle with different schemas (each app's own tables plus these),
 * so a schema-parameterised type would not accept both.
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
  Database | Parameters<Parameters<Database['transaction']>[0]>[0]
