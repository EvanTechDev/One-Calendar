import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createDrizzleAdapter } from '@zntr/auth/adapter'
import { authSchema } from '@zntr/auth/schema'
import { assertIsolated, connectIsolated } from './db-harness'

/** Run the desktop protocol contract against the deployed auth table shapes. */
export async function desktopDatabase() {
  const sql = await connectIsolated()
  if (!sql)
    throw new Error(
      'Desktop database acceptance requires AUTH_TEST_POSTGRES_URL',
    )
  const migration = (name: string) =>
    readFileSync(
      resolve(import.meta.dirname, '../../apps/calendar/drizzle', name),
      'utf8',
    )
  const base = migration('0000_opposite_joystick.sql')
  const core = ['User', 'Session', 'Account', 'Verification', 'twoFactor'].map(
    (name) => {
      const statement = base.match(
        new RegExp(`CREATE TABLE "${name}" \\([\\s\\S]*?\\n\\);`),
      )?.[0]
      if (!statement) throw new Error(`Missing base auth table ${name}`)
      return statement.replace(
        `"${name}"`,
        `"${name === 'twoFactor' ? 'two_factor' : name.toLowerCase()}"`,
      )
    },
  )
  const additions = [
    '0013_two_factor_lockout_fields.sql',
    '0016_account_issuer_identity.sql',
    '0017_oauth_provider_tables.sql',
    '0019_better_auth_mcp_oauth.sql',
    '0022_relax_legacy_account_issuer.sql',
  ].map(migration)
  const tables = [...core, ...additions].flatMap((text) =>
    [...text.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"([A-Za-z_]+)"/g)].map(
      (m) => m[1],
    ),
  )
  const quoted = tables.map((name) => `"${name}"`).join(', ')
  // Refuse to adopt or erase fixtures left by another suite or developer.
  for (const table of tables) {
    const [existing] =
      await sql`select to_regclass(${`"${table}"`}) as relation`
    if (existing?.relation) {
      await sql.end()
      throw new Error(
        `Desktop auth fixture requires an absent auth_test.${table}`,
      )
    }
  }
  const cleanup = async () => {
    await assertIsolated(sql)
    for (const table of [...tables].reverse()) {
      await sql.unsafe(`drop table if exists "${table}"`)
    }
    await sql.end()
  }
  try {
    for (const statement of core) await sql.unsafe(statement)
    await sql.unsafe(
      'alter table "session" add foreign key ("userId") references "user"("id") on delete cascade',
    )
    await sql.unsafe(
      'alter table "account" add foreign key ("userId") references "user"("id") on delete cascade',
    )
    await sql.unsafe(
      'alter table "two_factor" add foreign key ("userId") references "user"("id") on delete cascade',
    )
    await sql.unsafe(
      'create unique index "account_providerId_accountId_key" on "account" ("providerId", "accountId")',
    )
    for (const statements of additions) await sql.unsafe(statements)
  } catch (error) {
    await cleanup()
    throw error
  }
  return {
    database: createDrizzleAdapter(drizzle(sql, { schema: authSchema })),
    async reset() {
      await assertIsolated(sql)
      await sql.unsafe(`truncate table ${quoted}`)
    },
    cleanup,
  }
}
