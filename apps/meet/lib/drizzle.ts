import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { authSchema } from '@zntr/auth'
import { meetingsSchema } from '@zntr/meetings'

let _db: ReturnType<typeof drizzle> | null = null

type DbSsl =
  | 'verify-full'
  | 'require'
  | false
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
  if (mode === 'verify-full') return 'verify-full'
  if (mode === 'no-verify' || mode === 'require') return 'require'
  if (mode === 'disable') return false
  return 'require'
}

export function getDb() {
  if (!_db) {
    const connectionString =
      process.env.POSTGRES_URL || process.env.DATABASE_URL
    // Checked rather than asserted: `DATABASE_URL!` handed `undefined` to
    // postgres(), which fails deep inside the driver with a message that says
    // nothing about the missing variable.
    if (!connectionString) {
      throw new Error(
        'POSTGRES_URL or DATABASE_URL must be set (see apps/meet/.env.example)',
      )
    }
    const client = postgres(connectionString, {
      prepare: false,
      ssl: resolveDbSsl(),
    })
    _db = drizzle(client, { schema: { ...authSchema, ...meetingsSchema } })
  }
  return _db
}
