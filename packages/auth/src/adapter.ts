import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import * as schema from './schema'

type AuthSchema = typeof schema.authSchema

export interface CreateDrizzleAdapterOptions {
  provider?: 'pg' | 'mysql' | 'sqlite'
  schema?: Partial<AuthSchema>
}

export function createDrizzleAdapter(
  db: PgDatabase<any, any, any>,
  options: CreateDrizzleAdapterOptions = {},
) {
  const { provider = 'pg', schema: schemaOverride } = options

  return drizzleAdapter(db, {
    provider,
    schema: schemaOverride
      ? { ...schema.authSchema, ...schemaOverride }
      : schema.authSchema,
  })
}
