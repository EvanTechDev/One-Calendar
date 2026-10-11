import { attachDatabasePool } from '@vercel/functions'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

let _db: NodePgDatabase<typeof schema> | null = null

type DbSsl =
  | false
  | { rejectUnauthorized: boolean }
  | { ca: string; rejectUnauthorized: true }

function configuredCa(env: Record<string, string | undefined>): string | null {
  const ca = env.DATABASE_SSL_CA?.replace(/\\n/g, '\n').trim()
  if (!ca) return null
  if (
    !ca.startsWith('-----BEGIN CERTIFICATE-----') ||
    !ca.endsWith('-----END CERTIFICATE-----')
  ) {
    throw new Error('DATABASE_SSL_CA must contain a PEM certificate')
  }
  return ca
}

export function resolveDbSsl(
  env: Record<string, string | undefined> = process.env,
): DbSsl {
  const ca = configuredCa(env)
  if (ca) return { ca, rejectUnauthorized: true }

  const mode = env.DATABASE_SSL?.trim().toLowerCase()
  if (mode === 'verify-full') return { rejectUnauthorized: true }
  if (mode === 'disable') return false
  return { rejectUnauthorized: false }
}

// pg lets ssl parameters in the URL replace the `ssl` option entirely, and it
// reads `sslmode=require` as full verification. DATABASE_SSL owns TLS here.
const URL_SSL_PARAMS = ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl']

export function stripSslParams(connectionString: string): string {
  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    return connectionString
  }
  for (const param of URL_SSL_PARAMS) url.searchParams.delete(param)
  return url.toString()
}

export function getDb() {
  if (!_db) {
    const connectionString =
      process.env.POSTGRES_URL || process.env.DATABASE_URL!
    const pool = new Pool({
      connectionString: stripSslParams(connectionString),
      ssl: resolveDbSsl(),
    })
    attachDatabasePool(pool)
    _db = drizzle({ client: pool, schema })
  }
  return _db
}
