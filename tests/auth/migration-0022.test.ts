import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Sql } from 'postgres'
import { connectIsolated, databaseIsAvailable } from './db-harness'

const available = databaseIsAvailable()
const migration = fs.readFileSync(
  path.resolve(
    import.meta.dirname,
    '../../apps/calendar/drizzle/0022_relax_legacy_account_issuer.sql',
  ),
  'utf8',
)
let sql: Sql | null = null

async function migrate(db: Sql) {
  for (const statement of migration.split('--> statement-breakpoint')) {
    if (statement.trim()) await db.unsafe(statement)
  }
}

beforeAll(async () => {
  if (!available) return
  sql = await connectIsolated()
})

afterAll(async () => {
  if (!sql) return
  await sql`drop table if exists account cascade`
  await sql.end()
})

if (!available) {
  console.warn(
    '[tests/auth] No database configured — migration 0022 rehearsal is skipped.',
  )
}

describe.skipIf(!available)(
  'migration 0022, executed in the isolated schema',
  () => {
    it('permits new issuer-free accounts and preserves existing credentials and provider uniqueness', async () => {
      const db = sql!
      await db`drop table if exists account cascade`
      await db`
      create table account (
        id text primary key,
        "providerId" text not null,
        "accountId" text not null,
        issuer text not null,
        password text
      )
    `
      await db`
      create unique index "Account_providerId_accountId_key"
      on account ("providerId", "accountId")
    `
      await db`
      create unique index "account_issuer_accountId_uidx"
      on account (issuer, "accountId")
    `
      await db`
      insert into account (id, "providerId", "accountId", issuer, password)
      values ('old', 'credential', 'existing-user', 'local:credential', 'existing-hash')
    `
      await migrate(db)
      await migrate(db)

      expect(await db`select * from account where id = 'old'`).toEqual([
        {
          id: 'old',
          providerId: 'credential',
          accountId: 'existing-user',
          issuer: 'local:credential',
          password: 'existing-hash',
        },
      ])
      await db`
      insert into account (id, "providerId", "accountId", password)
      values ('new', 'credential', 'new-user', 'new-hash')
    `
      const [created] = await db`select issuer from account where id = 'new'`
      expect(created?.issuer).toBeNull()

      // Same external identity under two provider configurations is valid again.
      await db`
      insert into account (id, "providerId", "accountId", issuer)
      values ('one', 'provider-one', 'subject', 'https://issuer.example'),
             ('two', 'provider-two', 'subject', 'https://issuer.example')
    `
      await expect(db`
      insert into account (id, "providerId", "accountId")
      values ('duplicate', 'provider-one', 'subject')
    `).rejects.toMatchObject({ code: '23505' })
    })
  },
)
