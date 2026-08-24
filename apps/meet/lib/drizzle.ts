import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { authSchema } from '@zntr/auth'
import { meetingsSchema } from '@zntr/meetings'

let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (!_db) {
    const connectionString =
      process.env.POSTGRES_URL || process.env.DATABASE_URL!
    const client = postgres(connectionString, {
      prepare: false,
      ssl: 'require',
    })
    _db = drizzle(client, { schema: { ...authSchema, ...meetingsSchema } })
  }
  return _db
}
