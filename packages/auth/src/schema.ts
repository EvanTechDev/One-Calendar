import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  image: text('image'),
  twoFactorEnabled: boolean('twoFactorEnabled'),
  createdAt: timestamp('createdAt', {
    precision: 3,
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp('updatedAt', {
    precision: 3,
    withTimezone: true,
  }).notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', {
    precision: 3,
    withTimezone: true,
  }).notNull(),
  token: text('token').unique().notNull(),
  createdAt: timestamp('createdAt', {
    precision: 3,
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp('updatedAt', {
    precision: 3,
    withTimezone: true,
  }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    /**
     * Which authority vouches for this account, required since Better Auth 1.7.
     *
     * 1.7 identifies an external account by the unique pair
     * `(issuer, accountId)` rather than `(providerId, accountId)`: `providerId`
     * is the local provider *configuration*, which can be renamed or duplicated,
     * while the issuer is the authority itself. Two provider configurations
     * pointing at one OIDC authority must therefore share an issuer.
     *
     * Credential accounts have no external authority, so they take the
     * synthetic `local:credential`.
     */
    issuer: text('issuer').notNull(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt', {
      precision: 3,
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', {
      precision: 3,
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('createdAt', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    updatedAt: timestamp('updatedAt', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
  },
  (table) => ({
    /**
     * The pre-1.7 key, kept because dropping it is a separate decision from
     * adding the new one — and because it still usefully prevents one provider
     * configuration holding two rows for the same provider-side account.
     */
    accountUnique: uniqueIndex('Account_providerId_accountId_key').on(
      table.providerId,
      table.accountId,
    ),
    /** The 1.7 identity key. One external identity, one account row. */
    accountIdentityUnique: uniqueIndex('account_issuer_accountId_uidx').on(
      table.issuer,
      table.accountId,
    ),
  }),
)

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', {
    precision: 3,
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp('createdAt', { precision: 3, withTimezone: true }),
  updatedAt: timestamp('updatedAt', { precision: 3, withTimezone: true }),
})

export const twoFactor = pgTable('two_factor', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backupCodes').notNull(),
  verified: boolean('verified').default(false).notNull(),
  // Account-lockout fields required by better-auth >= 1.6.22 two-factor plugin
  failedVerificationCount: integer('failedVerificationCount')
    .default(0)
    .notNull(),
  lockedUntil: timestamp('lockedUntil', { precision: 3, withTimezone: true }),
  userId: text('userId')
    .unique()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

/**
 * Signing keys for the portal's JWTs, owned by the `jwt` plugin.
 *
 * Only the portal reads this table. A client app verifies against the published
 * JWKS endpoint, which is why a client needs no secret of any kind (ADR 0021).
 */
export const jwks = pgTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('publicKey').notNull(),
  privateKey: text('privateKey').notNull(),
  createdAt: timestamp('createdAt', { precision: 3, withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp('expiresAt', { precision: 3, withTimezone: true }),
  alg: text('alg'),
  crv: text('crv'),
})

/**
 * A registered OAuth client — one per app.
 *
 * `clientId` rather than `id` carries the identity: every other table's foreign
 * key targets it, which is a shape worth knowing because pointing those keys at
 * `id` produces a schema that looks right and cannot store a token.
 *
 * Array columns are `jsonb`, not Postgres arrays. That is what the Better Auth
 * drizzle adapter writes for a `string[]` field; a `text[]` column creates
 * cleanly and then fails on every insert.
 */
export const oauthClient = pgTable('oauthClient', {
  id: text('id').primaryKey(),
  clientId: text('clientId').unique().notNull(),
  clientSecret: text('clientSecret'),
  clientDiscoveryId: text('clientDiscoveryId'),
  disabled: boolean('disabled').default(false),
  /** First-party clients skip consent; a third-party client never would. */
  skipConsent: boolean('skipConsent'),
  enableEndSession: boolean('enableEndSession'),
  subjectType: text('subjectType'),
  scopes: jsonb('scopes'),
  /**
   * Machine-to-machine scope ceiling. Fail-closed: a client's user-delegated
   * scopes never authorise machine access, so this stays empty until an
   * administrator assigns it.
   */
  clientCredentialsScopes: jsonb('clientCredentialsScopes').default([]),
  userId: text('userId').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('createdAt', {
    precision: 3,
    withTimezone: true,
  }).defaultNow(),
  updatedAt: timestamp('updatedAt', {
    precision: 3,
    withTimezone: true,
  }).defaultNow(),
  name: text('name'),
  uri: text('uri'),
  icon: text('icon'),
  contacts: jsonb('contacts'),
  tos: text('tos'),
  policy: text('policy'),
  softwareId: text('softwareId'),
  softwareVersion: text('softwareVersion'),
  softwareStatement: text('softwareStatement'),
  redirectUris: jsonb('redirectUris').notNull(),
  postLogoutRedirectUris: jsonb('postLogoutRedirectUris'),
  backchannelLogoutUri: text('backchannelLogoutUri'),
  backchannelLogoutSessionRequired: boolean('backchannelLogoutSessionRequired'),
  tokenEndpointAuthMethod: text('tokenEndpointAuthMethod'),
  applicationType: text('applicationType'),
  jwks: text('jwks'),
  jwksUri: text('jwksUri'),
  grantTypes: jsonb('grantTypes'),
  responseTypes: jsonb('responseTypes'),
  requirePKCE: boolean('requirePKCE'),
  dpopBoundAccessTokens: boolean('dpopBoundAccessTokens').default(false),
  referenceId: text('referenceId'),
  metadata: jsonb('metadata'),
})

/** A protected resource (an API), with its own token lifetimes and scopes. */
export const oauthResource = pgTable('oauthResource', {
  id: text('id').primaryKey(),
  identifier: text('identifier').unique().notNull(),
  name: text('name').notNull(),
  accessTokenTtl: integer('accessTokenTtl'),
  refreshTokenTtl: integer('refreshTokenTtl'),
  signingAlgorithm: text('signingAlgorithm'),
  signingKeyId: text('signingKeyId'),
  allowedScopes: jsonb('allowedScopes'),
  customClaims: jsonb('customClaims'),
  dpopBoundAccessTokensRequired: boolean(
    'dpopBoundAccessTokensRequired',
  ).default(false),
  disabled: boolean('disabled').default(false),
  createdAt: timestamp('createdAt', {
    precision: 3,
    withTimezone: true,
  }).defaultNow(),
  updatedAt: timestamp('updatedAt', {
    precision: 3,
    withTimezone: true,
  }).defaultNow(),
  policyVersion: integer('policyVersion').default(1),
  metadata: jsonb('metadata'),
})

/** Which client may request tokens for which resource. */
export const oauthClientResource = pgTable('oauthClientResource', {
  id: text('id').primaryKey(),
  clientId: text('clientId')
    .notNull()
    .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
  resourceId: text('resourceId')
    .notNull()
    .references(() => oauthResource.identifier, { onDelete: 'cascade' }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('createdAt', {
    precision: 3,
    withTimezone: true,
  }).defaultNow(),
})

/**
 * Refresh tokens. Declared before access tokens because an access token
 * references the refresh token that minted it.
 *
 * `sessionId` is `set null`, not `cascade`: signing out must not erase the
 * record that a token was issued. The plugin marks such tokens revoked, and
 * introspection reports a token whose session has ended as inactive.
 */
export const oauthRefreshToken = pgTable(
  'oauthRefreshToken',
  {
    id: text('id').primaryKey(),
    token: text('token').unique().notNull(),
    clientId: text('clientId')
      .notNull()
      .references(() => oauthClient.clientId),
    sessionId: text('sessionId').references(() => session.id, {
      onDelete: 'set null',
    }),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    referenceId: text('referenceId'),
    authorizationCodeId: text('authorizationCodeId'),
    resources: jsonb('resources'),
    requestedUserInfoClaims: jsonb('requestedUserInfoClaims'),
    expiresAt: timestamp('expiresAt', { precision: 3, withTimezone: true }),
    createdAt: timestamp('createdAt', {
      precision: 3,
      withTimezone: true,
    }).defaultNow(),
    revoked: timestamp('revoked', { precision: 3, withTimezone: true }),
    rotatedAt: timestamp('rotatedAt', { precision: 3, withTimezone: true }),
    rotationReplayResponse: text('rotationReplayResponse'),
    rotationReplayExpiresAt: timestamp('rotationReplayExpiresAt', {
      precision: 3,
      withTimezone: true,
    }),
    authTime: timestamp('authTime', { precision: 3, withTimezone: true }),
    confirmation: jsonb('confirmation'),
    scopes: jsonb('scopes').notNull(),
  },
  (table) => ({
    sessionIdx: index('oauthRefreshToken_sessionId_idx').on(table.sessionId),
  }),
)

export const oauthAccessToken = pgTable(
  'oauthAccessToken',
  {
    id: text('id').primaryKey(),
    /**
     * Nullable: a JWT access token is self-contained and never stored, so only
     * an opaque token carries a value here. That is also why a JWT cannot be
     * revoked individually (ADR 0021).
     */
    token: text('token').unique(),
    clientId: text('clientId')
      .notNull()
      .references(() => oauthClient.clientId),
    sessionId: text('sessionId').references(() => session.id, {
      onDelete: 'set null',
    }),
    userId: text('userId').references(() => user.id, { onDelete: 'cascade' }),
    referenceId: text('referenceId'),
    authorizationCodeId: text('authorizationCodeId'),
    resources: jsonb('resources'),
    requestedUserInfoClaims: jsonb('requestedUserInfoClaims'),
    refreshId: text('refreshId').references(() => oauthRefreshToken.id, {
      onDelete: 'cascade',
    }),
    expiresAt: timestamp('expiresAt', { precision: 3, withTimezone: true }),
    createdAt: timestamp('createdAt', {
      precision: 3,
      withTimezone: true,
    }).defaultNow(),
    revoked: timestamp('revoked', { precision: 3, withTimezone: true }),
    confirmation: jsonb('confirmation'),
    scopes: jsonb('scopes').notNull(),
  },
  (table) => ({
    tokenIdx: index('oauthAccessToken_token_idx').on(table.token),
    sessionIdx: index('oauthAccessToken_sessionId_idx').on(table.sessionId),
  }),
)

/** What a user has agreed a client may do. Deleting the row revokes consent. */
export const oauthConsent = pgTable(
  'oauthConsent',
  {
    id: text('id').primaryKey(),
    clientId: text('clientId')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    userId: text('userId').references(() => user.id, { onDelete: 'cascade' }),
    referenceId: text('referenceId'),
    resources: jsonb('resources'),
    requestedUserInfoClaims: jsonb('requestedUserInfoClaims'),
    scopes: jsonb('scopes').notNull(),
    createdAt: timestamp('createdAt', {
      precision: 3,
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp('updatedAt', {
      precision: 3,
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => ({
    userClientIdx: index('oauthConsent_userId_clientId_idx').on(
      table.userId,
      table.clientId,
    ),
  }),
)

/**
 * Replay protection for `private_key_jwt` client assertions: a `jti` may be
 * used once, and the row is kept only until the assertion could no longer be
 * valid.
 */
export const oauthClientAssertion = pgTable(
  'oauthClientAssertion',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expiresAt', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
  },
  (table) => ({
    expiryIdx: index('oauthClientAssertion_expiresAt_idx').on(table.expiresAt),
  }),
)

/** The tables every app needs to read a user. */
export const authSchema = {
  user,
  session,
  account,
  verification,
  twoFactor,
}

/**
 * The portal's additional tables.
 *
 * Separate from `authSchema` on purpose: only `apps/auth` should have these in
 * its drizzle instance. A client app that can query `oauthClient` can read
 * client secrets, which is exactly the authority ADR 0021 takes away from it.
 */
export const oauthProviderSchema = {
  jwks,
  oauthClient,
  oauthResource,
  oauthClientResource,
  oauthRefreshToken,
  oauthAccessToken,
  oauthConsent,
  oauthClientAssertion,
}
