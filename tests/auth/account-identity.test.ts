import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { connectIsolated, databaseIsAvailable } from './db-harness'
import type { Sql } from 'postgres'

/**
 * Better Auth 1.7 identifies an external account by the unique pair
 * `(issuer, accountId)`, and `issuer` is required. Our 11 accounts are all
 * `providerId = 'credential'`, so exactly one rule applies:
 *
 *   issuer    = 'local:credential'
 *   accountId = the linked user's id
 *
 * The migration that adds this touches the table holding real users'
 * credentials, so its shape is pinned here rather than trusted. These tests run
 * against the isolated test schema (see db-harness) with a replica of the
 * account table, never against the real one.
 */
const available = databaseIsAvailable()

let sql: Sql | null = null

/**
 * A stand-in for the real `account` table, in the test schema.
 *
 * Deliberately a replica rather than the real table: the point is to prove the
 * migration's DDL and backfill behave correctly, and doing that against 11
 * real credential rows would risk the thing the harness exists to protect.
 */
async function createAccountReplica(db: Sql) {
  await db`drop table if exists account_replica cascade`
  await db`
    create table account_replica (
      id text primary key,
      "accountId" text not null,
      "providerId" text not null,
      "userId" text not null,
      password text,
      "createdAt" timestamp(3) with time zone not null default now()
    )
  `
}

async function seedCredentialAccounts(db: Sql, count: number) {
  for (let index = 0; index < count; index += 1) {
    const userId = `user-${index}`
    await db`
      insert into account_replica (id, "accountId", "providerId", "userId", password)
      values (${`acc-${index}`}, ${userId}, 'credential', ${userId}, 'hashed')
    `
  }
}

/** The migration under test, as it will be written by hand. */
async function applyIssuerMigration(db: Sql) {
  // Nullable first: a required column with no default fails on a non-empty
  // table, and the 1.7 guide's ordering exists for that reason.
  await db`alter table account_replica add column if not exists issuer text`

  await db`
    update account_replica
    set issuer = 'local:credential'
    where "providerId" = 'credential' and issuer is null
  `

  // The guide is explicit that `auth migrate` never emits this, so it is
  // hand-written -- and only after the backfill leaves no NULLs.
  await db`alter table account_replica alter column issuer set not null`
  await db`
    create unique index if not exists account_replica_issuer_accountid_uidx
    on account_replica (issuer, "accountId")
  `
}

beforeAll(async () => {
  if (!available) return
  sql = await connectIsolated()
})

afterAll(async () => {
  if (sql) {
    await sql`drop table if exists account_replica cascade`
    await sql.end()
  }
})

describe.skipIf(!available)('account identity migration', () => {
  it('gives every credential account the local:credential issuer', async () => {
    await createAccountReplica(sql!)
    await seedCredentialAccounts(sql!, 11)
    await applyIssuerMigration(sql!)

    const rows = await sql!<{ issuer: string }[]>`
      select issuer from account_replica
    `
    expect(rows).toHaveLength(11)
    expect(new Set(rows.map((row) => row.issuer))).toEqual(
      new Set(['local:credential']),
    )
  })

  it('leaves no null issuer, so the not-null constraint can hold', async () => {
    const [row] = await sql!<{ nulls: number }[]>`
      select count(*)::int as nulls from account_replica where issuer is null
    `
    expect(row!.nulls).toBe(0)
  })

  it('keeps accountId equal to the linked user id', async () => {
    // Our credential rows already satisfy this, so the migration must not
    // rewrite `accountId` -- an unnecessary rewrite of a credential identifier
    // is how a user loses the ability to sign in.
    const [row] = await sql!<{ mismatched: number }[]>`
      select count(*)::int as mismatched
      from account_replica
      where "accountId" <> "userId"
    `
    expect(row!.mismatched).toBe(0)
  })

  it('preserves every password hash', async () => {
    // The migration must be identity-adding, not credential-touching.
    const [row] = await sql!<{ without_password: number }[]>`
      select count(*)::int as without_password
      from account_replica
      where password is null
    `
    expect(row!.without_password).toBe(0)
  })

  it('rejects a second account with the same issuer and accountId', async () => {
    // The unique index is the whole point of the migration: one external
    // identity cannot map to two account rows. `issuer` is supplied explicitly
    // so the insert reaches the index -- omitting it fails on the not-null
    // constraint first, which would make this test pass for the wrong reason.
    await expect(
      sql!`
        insert into account_replica (id, "accountId", "providerId", "userId", password, issuer)
        values ('acc-dupe', 'user-0', 'credential', 'someone-else', 'hashed', 'local:credential')
      `,
    ).rejects.toThrow(/duplicate key|unique/i)
  })

  it('still allows the same accountId under a different issuer', async () => {
    // Proves the index is compound rather than a unique constraint on
    // accountId alone -- a future social provider must be able to reuse an id.
    await sql!`
      insert into account_replica (id, "accountId", "providerId", "userId", password, issuer)
      values ('acc-social', 'user-0', 'google', 'user-0', null, 'https://accounts.google.com')
    `
    const [row] = await sql!<{ count: number }[]>`
      select count(*)::int as count from account_replica where "accountId" = 'user-0'
    `
    expect(row!.count).toBe(2)
  })

  it('is idempotent, so a re-run cannot corrupt the table', async () => {
    // A migration that has to be applied exactly once is a migration that will
    // eventually be applied twice.
    await applyIssuerMigration(sql!)
    const [row] = await sql!<{ nulls: number }[]>`
      select count(*)::int as nulls from account_replica where issuer is null
    `
    expect(row!.nulls).toBe(0)
  })
})
