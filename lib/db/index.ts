import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  dbPool: Pool | undefined
}

function createPool() {
  const databaseUrl = process.env.POSTGRES_URL
  if (!databaseUrl) {
    throw new Error('Missing POSTGRES_URL environment variable')
  }

  return new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false },
  })
}

function getPool() {
  if (globalForDb.dbPool) {
    return globalForDb.dbPool
  }

  const pool = createPool()
  if (process.env.NODE_ENV !== 'production') {
    globalForDb.dbPool = pool
  }

  return pool
}

export const db = drizzle(getPool(), { schema })

export { schema }
