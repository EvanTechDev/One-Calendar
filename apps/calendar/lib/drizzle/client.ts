import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle> | null = null

/**
 * Resolves the `postgres` driver's `ssl` option.
 *
 * `'require'` encrypts but sets `rejectUnauthorized: false` (see the driver's
 * connection.js), so it accepts any certificate — including an attacker's.
 * `'verify-full'` falls through to Node's TLS defaults, which verify the chain
 * and the hostname.
 *
 * Local databases often use self-signed certificates, so verification can be
 * disabled explicitly with `DATABASE_SSL=no-verify`. That value is intended for
 * development only and is never a safe production setting.
 */
export function resolveDbSsl(
  env: {
    DATABASE_SSL?: string
    [key: string]: string | undefined
  } = process.env,
): 'verify-full' | 'require' | false {
  const mode = env.DATABASE_SSL?.trim().toLowerCase()
  if (mode === 'disable') return false
  if (mode === 'no-verify') return 'require'
  return 'verify-full'
}

export function getDb() {
  if (!_db) {
    const connectionString =
      process.env.POSTGRES_URL || process.env.DATABASE_URL!
    const client = postgres(connectionString, {
      prepare: false,
      ssl: resolveDbSsl(),
    })
    _db = drizzle(client, { schema })
  }
  return _db
}
