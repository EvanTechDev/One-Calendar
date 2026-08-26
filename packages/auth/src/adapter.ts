import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import * as schema from './schema'

type AuthSchema = typeof schema.authSchema
type PortalSchema = AuthSchema & typeof schema.oauthProviderSchema

export interface CreateDrizzleAdapterOptions {
  provider?: 'pg' | 'mysql' | 'sqlite'
  schema?: Partial<PortalSchema>
  /**
   * Whether to include the OAuth provider's tables.
   *
   * Off by default, and that default is the security boundary: a client app's
   * adapter must not be able to reach `oauthClient`, which holds client secrets
   * (ADR 0021). Only the portal passes `true`.
   */
  includeOAuthProvider?: boolean
}

export function createDrizzleAdapter(
  db: PgDatabase<any, any, any>,
  options: CreateDrizzleAdapterOptions = {},
) {
  const {
    provider = 'pg',
    schema: schemaOverride,
    includeOAuthProvider = false,
  } = options

  // The adapter resolves a model name to a drizzle table through this object, so
  // a table missing here is not a type error -- it is a runtime
  // "model was not found in the schema object" on the first request that needs
  // it. The portal's OAuth tables were exactly that: absent, and invisible until
  // an authorize call failed.
  const base = includeOAuthProvider
    ? { ...schema.authSchema, ...schema.oauthProviderSchema }
    : schema.authSchema

  return drizzleAdapter(db, {
    provider,
    schema: schemaOverride ? { ...base, ...schemaOverride } : base,
  })
}
