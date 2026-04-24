import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const grants = sqliteTable('grants', {
  id: text('id').primaryKey(),
  did: text('did').notNull(),
  clientId: text('client_id').notNull(),
  scopes: text('scopes').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const authorizationCodes = sqliteTable('authorization_codes', {
  code: text('code').primaryKey(),
  did: text('did').notNull(),
  clientId: text('client_id').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge').notNull(),
  codeChallengeMethod: text('code_challenge_method').notNull(),
  scope: text('scope').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const refreshTokens = sqliteTable('refresh_tokens', {
  tokenId: text('token_id').primaryKey(),
  did: text('did').notNull(),
  clientId: text('client_id').notNull(),
  scope: text('scope').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})
