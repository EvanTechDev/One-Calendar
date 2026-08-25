import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { authSchema } from '@zntr/auth'
import { meetingsSchema } from '@zntr/meetings'

let _db: ReturnType<typeof drizzle> | null = null

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
      ssl: 'require',
    })
    _db = drizzle(client, { schema: { ...authSchema, ...meetingsSchema } })
  }
  return _db
}
