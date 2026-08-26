import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { connectIsolated, databaseIsAvailable } from './db-harness'
import type { Sql } from 'postgres'

/**
 * Runs the REAL migration file against a replica of the real table, in the
 * isolated test schema.
 *
 * The previous test pinned the migration's intended shape; this one executes the
 * SQL that will actually be applied to production. Those are different claims,
 * and only this one catches a typo, a missing `statement-breakpoint`, or a guard
 * that does not fire.
 *
 * A production table holding 11 users' credentials gets its migration rehearsed
 * before it is run, not after.
 */
const available = databaseIsAvailable()

const MIGRATION = path.resolve(
  import.meta.dirname,
  '../../apps/calendar/drizzle/0016_account_issuer_identity.sql',
)

let sql: Sql | null = null

/** The migration targets `account`; the replica takes that name in our schema. */
async function createAccountTable(db: Sql) {
  await db`drop table if exists account cascade`
  await db`
    create table account (
      id text primary key,
      "accountId" text not null,
      "providerId" text not null,
      "userId" text not null,
      "accessToken" text,
      "refreshToken" text,
      "idToken" text,
      scope text,
      password text,
      "createdAt" timestamp(3) with time zone not null default now(),
      "updatedAt" timestamp(3) with time zone not null default now()
    )
  `
  await db`
    create unique index "Account_providerId_accountId_key"
    on account ("providerId", "accountId")
  `
}

/**
 * Applies the migration exactly as the runner will: split on the
 * `statement-breakpoint` marker drizzle uses, each chunk executed in order.
 */
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

async function seedCredential(db: Sql, index: number) {
  const userId = `user-${index}`
  await db`
    insert into account (id, "accountId", "providerId", "userId", password)
    values (${`acc-${index}`}, ${userId}, 'credential', ${userId}, ${`hash-${index}`})
  `
}

beforeAll(async () => {
  if (!available) return
  sql = await connectIsolated()
})

afterAll(async () => {
  if (sql) {
    await sql`drop table if exists account cascade`
    await sql.end()
  }
})

describe.skipIf(!available)('migration 0016, executed', () => {
  it('exists where the migration runner will look for it', () => {
    expect(fs.existsSync(MIGRATION)).toBe(true)
  })

  it('backfills the production shape: 11 credential accounts', async () => {
    await createAccountTable(sql!)
    for (let index = 0; index < 11; index += 1) {
      await seedCredential(sql!, index)
    }

    await runMigration(sql!)

    const rows = await sql!<{ issuer: string; account_id: string }[]>`
      select issuer, "accountId" as account_id from account order by id
    `
    expect(rows).toHaveLength(11)
    expect(new Set(rows.map((row) => row.issuer))).toEqual(
      new Set(['local:credential']),
    )
  })

  it('does not rewrite accountId', async () => {
    // Our rows already satisfy `accountId = userId`. Rewriting a credential
    // identifier that is already correct is pure risk.
    const [row] = await sql!<{ mismatched: number }[]>`
      select count(*)::int as mismatched from account where "accountId" <> "userId"
    `
    expect(row!.mismatched).toBe(0)
  })

  it('does not touch password hashes', async () => {
    const rows = await sql!<{ id: string; password: string }[]>`
      select id, password from account order by id
    `
    for (const row of rows) {
      const index = row.id.replace('acc-', '')
      expect(row.password, row.id).toBe(`hash-${index}`)
    }
  })

  it('makes issuer NOT NULL', async () => {
    const [row] = await sql!<{ is_nullable: string }[]>`
      select is_nullable from information_schema.columns
      where table_name = 'account' and column_name = 'issuer'
        and table_schema = current_schema()
    `
    expect(row!.is_nullable).toBe('NO')
  })

  it('creates the compound identity index', async () => {
    const [row] = await sql!<{ indexdef: string }[]>`
      select indexdef from pg_indexes
      where schemaname = current_schema()
        and indexname = 'account_issuer_accountId_uidx'
    `
    expect(row?.indexdef).toMatch(/UNIQUE/i)
    expect(row!.indexdef).toMatch(/issuer/)
    expect(row!.indexdef).toMatch(/accountId/)
  })

  it('is idempotent, so a re-run cannot corrupt the table', async () => {
    // A migration that must be applied exactly once will eventually be applied
    // twice. Every statement is guarded (IF NOT EXISTS / IS NULL), so this must
    // simply succeed.
    await runMigration(sql!)
    const [row] = await sql!<{ count: number }[]>`
      select count(*)::int as count from account
    `
    expect(row!.count).toBe(11)
  })

  it('refuses to complete when a row cannot be classified', async () => {
    // The guard that matters. An issuer must come from the authority itself;
    // guessing one is how two distinct identities silently become one. An
    // unrecognised provider has to stop the migration.
    await createAccountTable(sql!)
    await seedCredential(sql!, 0)
    await sql!`
      insert into account (id, "accountId", "providerId", "userId")
      values ('acc-social', 'sub-abc', 'google', 'user-0')
    `

    await expect(runMigration(sql!)).rejects.toThrow(/unclassified/i)

    // And it stopped BEFORE constraining the column, so the table is still
    // usable and the operator can add the rule and retry.
    const [column] = await sql!<{ is_nullable: string }[]>`
      select is_nullable from information_schema.columns
      where table_name = 'account' and column_name = 'issuer'
        and table_schema = current_schema()
    `
    expect(column!.is_nullable).toBe('YES')
  })
})
