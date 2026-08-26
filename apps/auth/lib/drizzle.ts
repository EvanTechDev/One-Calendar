import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { authSchema, oauthProviderSchema } from '@zntr/auth'

let _db: ReturnType<typeof drizzle> | null = null

/**
 * The portal's database handle.
 *
 * The only drizzle instance in the monorepo that carries `oauthProviderSchema`.
 * A client app must not have it: `oauthClient` holds client secrets, and an app
 * able to read those could impersonate another client (ADR 0021).
 */
export function getDb() {
  if (!_db) {
    const connectionString =
      process.env.POSTGRES_URL || process.env.DATABASE_URL
    // Checked rather than asserted: passing `undefined` to postgres() fails deep
    // inside the driver with a message that says nothing about the missing
    // variable.
    if (!connectionString) {
      throw new Error(
        'POSTGRES_URL or DATABASE_URL must be set (see apps/auth/.env.example)',
      )
    }
    const client = postgres(connectionString, {
      prepare: false,
      ssl: 'require',
    })
    _db = drizzle(client, {
      schema: { ...authSchema, ...oauthProviderSchema },
    })
  }
  return _db
}
