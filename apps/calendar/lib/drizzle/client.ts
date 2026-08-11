import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

let _db: PostgresJsDatabase<typeof schema> | null = null
let _client: ReturnType<typeof postgres> | null = null

export function getDb() {
  if (!_db) {
    const connectionString =
      process.env.POSTGRES_URL || process.env.DATABASE_URL!
    _client = postgres(connectionString, {
      prepare: false,
      ssl: 'require',
    })
    _db = drizzle(_client, { schema })
  }
  return _db
}

export function getRawClient() {
  if (!_client) {
    getDb()
  }
  return _client!
}
