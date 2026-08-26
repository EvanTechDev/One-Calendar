import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { connectIsolated, databaseIsAvailable } from './db-harness'
import type { Sql } from 'postgres'

/**
 * Rehearses the OAuth provider migration against the isolated test schema, and
 * pins the decisions that a hand-written migration can get wrong silently.
 *
 * The field shapes come from asking the library (`getAuthTables`) rather than
 * from reading the docs, and two of them would break the portal at runtime if
 * guessed:
 *
 * - `string[]` maps to **jsonb**, not a Postgres array. A `text[]` column
 *   type-checks fine and then fails on every insert.
 * - Foreign keys point at `oauthClient.clientId` and
 *   `oauthResource.identifier`, NOT at those tables' `id`. Pointing them at
 *   `id` produces a schema that looks right and cannot store a token.
 *
 * The migration is executed here, not merely described, so a typo or a missing
 * statement-breakpoint fails in a test rather than in production.
 */
const available = databaseIsAvailable()

const MIGRATION = path.resolve(
  import.meta.dirname,
  '../../apps/calendar/drizzle/0017_oauth_provider_tables.sql',
)

const NEW_TABLES = [
  'jwks',
  'oauthClient',
  'oauthResource',
  'oauthClientResource',
  'oauthRefreshToken',
  'oauthAccessToken',
  'oauthConsent',
  'oauthClientAssertion',
]

let sql: Sql | null = null

/**
 * The tables the OAuth tables reference. Replicas in the test schema, because
 * the migration's foreign keys must resolve for it to run at all.
 */
async function createReferencedTables(db: Sql) {
  await db`
    create table if not exists "user" (
      id text primary key,
      name text not null,
      email text unique not null
    )
  `
  await db`
    create table if not exists "session" (
      id text primary key,
      token text unique not null,
      "userId" text not null references "user"(id) on delete cascade
    )
  `
}

async function runMigration(db: Sql) {
  const contents = fs.readFileSync(MIGRATION, 'utf8')
  const statements = contents
    .split('--> statement-breakpoint')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
  for (const statement of statements) {
    await db.unsafe(statement)
  }
}

async function columnType(
  db: Sql,
  table: string,
  column: string,
): Promise<string | null> {
  const [row] = await db<{ data_type: string }[]>`
    select data_type from information_schema.columns
    where table_schema = current_schema()
      and table_name = ${table}
      and column_name = ${column}
  `
  return row?.data_type ?? null
}

beforeAll(async () => {
  if (!available) return
  sql = await connectIsolated()
  await createReferencedTables(sql)
  // Dropped in dependency order so a re-run starts clean.
  for (const table of [...NEW_TABLES].reverse()) {
    await sql.unsafe(`drop table if exists "${table}" cascade`)
  }
  await runMigration(sql)
})

afterAll(async () => {
  if (!sql) return
  for (const table of [...NEW_TABLES].reverse()) {
    await sql.unsafe(`drop table if exists "${table}" cascade`)
  }
  await sql`drop table if exists "session" cascade`
  await sql`drop table if exists "user" cascade`
  await sql.end()
})

describe.skipIf(!available)('OAuth provider schema', () => {
  it('creates every table the plugin expects', async () => {
    for (const table of NEW_TABLES) {
      const [row] = await sql!<{ found: number }[]>`
        select count(*)::int as found from information_schema.tables
        where table_schema = current_schema() and table_name = ${table}
      `
      expect(row!.found, table).toBe(1)
    }
  })

  it('stores string[] fields as jsonb, which is what the adapter writes', async () => {
    // A `text[]` column type-checks and then fails on every insert. This is the
    // single most likely way a hand-written migration for this plugin is wrong.
    expect(await columnType(sql!, 'oauthClient', 'redirectUris')).toBe('jsonb')
    expect(await columnType(sql!, 'oauthAccessToken', 'scopes')).toBe('jsonb')
    expect(await columnType(sql!, 'oauthRefreshToken', 'resources')).toBe(
      'jsonb',
    )
  })

  it('makes clientId unique, so a client cannot be impersonated by a twin', async () => {
    await sql!`
      insert into "oauthClient" (id, "clientId", "redirectUris")
      values ('c1', 'client-one', '["https://a.example.com/cb"]'::jsonb)
    `
    await expect(
      sql!`
        insert into "oauthClient" (id, "clientId", "redirectUris")
        values ('c2', 'client-one', '["https://b.example.com/cb"]'::jsonb)
      `,
    ).rejects.toThrow(/duplicate key|unique/i)
  })

  it('links tokens to clientId rather than to the client row id', async () => {
    // The plugin's foreign keys target `oauthClient.clientId`. A migration that
    // pointed them at `id` would look correct and be unable to store a token.
    await sql!`
      insert into "oauthAccessToken" (id, token, "clientId", scopes)
      values ('t1', 'tok-1', 'client-one', '["openid"]'::jsonb)
    `
    const [row] = await sql!<{ client_id: string }[]>`
      select "clientId" as client_id from "oauthAccessToken" where id = 't1'
    `
    expect(row!.client_id).toBe('client-one')
  })

  it('rejects a token for a client that does not exist', async () => {
    await expect(
      sql!`
        insert into "oauthAccessToken" (id, token, "clientId", scopes)
        values ('t-orphan', 'tok-orphan', 'no-such-client', '["openid"]'::jsonb)
      `,
    ).rejects.toThrow(/foreign key/i)
  })

  it('refuses to delete a client while its tokens still exist', async () => {
    // Deliberate, and worth pinning: the plugin's token tables declare no
    // ON DELETE behaviour, so Postgres defaults to NO ACTION. Deleting a client
    // out from under live tokens would leave them referencing nothing, so the
    // database refuses — which means deleting a client is a two-step operation
    // (revoke its tokens, then delete it) rather than one DELETE.
    //
    // Discovered by this test failing. Left as the library defines it rather
    // than "fixed" with a cascade: a cascade would silently destroy the record
    // that tokens were ever issued to that client.
    await expect(
      sql!`delete from "oauthClient" where "clientId" = 'client-one'`,
    ).rejects.toThrow(/foreign key/i)
  })

  it('cascades a client deletion to its resource links once tokens are gone', async () => {
    await sql!`
      insert into "oauthResource" (id, identifier, name)
      values ('r1', 'https://api.example.com', 'API')
      on conflict do nothing
    `
    await sql!`
      insert into "oauthClientResource" (id, "clientId", "resourceId")
      values ('cr1', 'client-one', 'https://api.example.com')
    `
    // The revoke-then-delete order the constraint above forces.
    await sql!`delete from "oauthAccessToken" where "clientId" = 'client-one'`
    await sql!`delete from "oauthClient" where "clientId" = 'client-one'`

    const [row] = await sql!<{ count: number }[]>`
      select count(*)::int as count from "oauthClientResource" where id = 'cr1'
    `
    expect(row!.count).toBe(0)
  })

  it('keeps a token when its session ends, setting the link null', async () => {
    // Sign-out must not delete the audit trail of tokens that were issued. The
    // plugin's own revocation marks them revoked; losing the row entirely would
    // erase the record.
    await sql!`
      insert into "user" (id, name, email) values ('u1', 'Ada', 'ada@example.com')
      on conflict do nothing
    `
    await sql!`
      insert into "session" (id, token, "userId") values ('s1', 'sess-1', 'u1')
      on conflict do nothing
    `
    await sql!`
      insert into "oauthClient" (id, "clientId", "redirectUris")
      values ('c9', 'client-nine', '["https://c.example.com/cb"]'::jsonb)
    `
    await sql!`
      insert into "oauthAccessToken" (id, token, "clientId", "sessionId", "userId", scopes)
      values ('t9', 'tok-9', 'client-nine', 's1', 'u1', '["openid"]'::jsonb)
    `
    await sql!`delete from "session" where id = 's1'`

    const [row] = await sql!<{ session_id: string | null }[]>`
      select "sessionId" as session_id from "oauthAccessToken" where id = 't9'
    `
    expect(row!.session_id).toBeNull()
  })

  it('is idempotent, so a re-run cannot fail half-way', async () => {
    await runMigration(sql!)
    const [row] = await sql!<{ found: number }[]>`
      select count(*)::int as found from information_schema.tables
      where table_schema = current_schema() and table_name = 'oauthClient'
    `
    expect(row!.found).toBe(1)
  })
})
