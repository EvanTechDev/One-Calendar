import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  integer,
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
  createdAt: timestamp('createdAt', { precision: 3 }).notNull(),
  updatedAt: timestamp('updatedAt', { precision: 3 }).notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { precision: 3 }).notNull(),
  token: text('token').unique().notNull(),
  createdAt: timestamp('createdAt', { precision: 3 }).notNull(),
  updatedAt: timestamp('updatedAt', { precision: 3 }).notNull(),
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
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { precision: 3 }),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { precision: 3 }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('createdAt', { precision: 3 }).notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3 }).notNull(),
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
  expiresAt: timestamp('expiresAt', { precision: 3 }).notNull(),
  createdAt: timestamp('createdAt', { precision: 3 }),
  updatedAt: timestamp('updatedAt', { precision: 3 }),
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

export const jwks = pgTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('publicKey').notNull(),
  privateKey: text('privateKey').notNull(),
  createdAt: timestamp('createdAt', { precision: 3, withTimezone: true })
    .defaultNow()
    .notNull(),
  expiresAt: timestamp('expiresAt', { precision: 3, withTimezone: true }),
  alg: text('alg'),
  crv: text('crv'),
})

export const oauthClient = pgTable(
  'oauthClient',
  {
    id: text('id').primaryKey(),
    clientId: text('clientId').notNull().unique(),
    clientSecret: text('clientSecret'),
    clientDiscoveryId: text('clientDiscoveryId'),
    disabled: boolean('disabled').default(false),
    skipConsent: boolean('skipConsent'),
    enableEndSession: boolean('enableEndSession'),
    subjectType: text('subjectType'),
    scopes: jsonb('scopes').$type<string[]>(),
    clientCredentialsScopes: jsonb('clientCredentialsScopes')
      .$type<string[]>()
      .default([]),
    userId: text('userId').references(() => user.id, {
      onDelete: 'set null',
    }),
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
    contacts: jsonb('contacts').$type<string[]>(),
    tos: text('tos'),
    policy: text('policy'),
    softwareId: text('softwareId'),
    softwareVersion: text('softwareVersion'),
    softwareStatement: text('softwareStatement'),
    redirectUris: jsonb('redirectUris').$type<string[]>().notNull(),
    postLogoutRedirectUris: jsonb('postLogoutRedirectUris').$type<string[]>(),
    backchannelLogoutUri: text('backchannelLogoutUri'),
    backchannelLogoutSessionRequired: boolean(
      'backchannelLogoutSessionRequired',
    ),
    tokenEndpointAuthMethod: text('tokenEndpointAuthMethod'),
    applicationType: text('applicationType'),
    jwks: text('jwks'),
    jwksUri: text('jwksUri'),
    grantTypes: jsonb('grantTypes').$type<string[]>(),
    responseTypes: jsonb('responseTypes').$type<string[]>(),
    requirePKCE: boolean('requirePKCE'),
    dpopBoundAccessTokens: boolean('dpopBoundAccessTokens').default(false),
    referenceId: text('referenceId'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => ({
    userIdIdx: index('oauthClient_userId_idx').on(table.userId),
  }),
)

export const oauthResource = pgTable('oauthResource', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull().unique(),
  name: text('name').notNull(),
  accessTokenTtl: integer('accessTokenTtl'),
  refreshTokenTtl: integer('refreshTokenTtl'),
  signingAlgorithm: text('signingAlgorithm'),
  signingKeyId: text('signingKeyId'),
  allowedScopes: jsonb('allowedScopes').$type<string[]>(),
  customClaims: jsonb('customClaims').$type<Record<string, unknown>>(),
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
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
})

export const oauthClientResource = pgTable(
  'oauthClientResource',
  {
    id: text('id').primaryKey(),
    clientId: text('clientId')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    resourceId: text('resourceId')
      .notNull()
      .references(() => oauthResource.identifier, { onDelete: 'cascade' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('createdAt', {
      precision: 3,
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => ({
    clientIdIdx: index('oauthClientResource_clientId_idx').on(table.clientId),
    resourceIdIdx: index('oauthClientResource_resourceId_idx').on(
      table.resourceId,
    ),
    clientResourceUq: uniqueIndex(
      'oauthClientResource_clientId_resourceId_uidx',
    ).on(table.clientId, table.resourceId),
  }),
)

export const oauthRefreshToken = pgTable(
  'oauthRefreshToken',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
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
    resources: jsonb('resources').$type<string[]>(),
    requestedUserInfoClaims: jsonb('requestedUserInfoClaims').$type<string[]>(),
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
    confirmation: jsonb('confirmation').$type<Record<string, unknown>>(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
  },
  (table) => ({
    clientIdIdx: index('oauthRefreshToken_clientId_idx').on(table.clientId),
    sessionIdIdx: index('oauthRefreshToken_sessionId_idx').on(table.sessionId),
    userIdIdx: index('oauthRefreshToken_userId_idx').on(table.userId),
    authorizationCodeIdx: index('oauthRefreshToken_authorizationCodeId_idx').on(
      table.authorizationCodeId,
    ),
  }),
)

export const oauthAccessToken = pgTable(
  'oauthAccessToken',
  {
    id: text('id').primaryKey(),
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
    resources: jsonb('resources').$type<string[]>(),
    requestedUserInfoClaims: jsonb('requestedUserInfoClaims').$type<string[]>(),
    refreshId: text('refreshId').references(() => oauthRefreshToken.id, {
      onDelete: 'cascade',
    }),
    expiresAt: timestamp('expiresAt', { precision: 3, withTimezone: true }),
    createdAt: timestamp('createdAt', {
      precision: 3,
      withTimezone: true,
    }).defaultNow(),
    revoked: timestamp('revoked', { precision: 3, withTimezone: true }),
    confirmation: jsonb('confirmation').$type<Record<string, unknown>>(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
  },
  (table) => ({
    tokenIdx: index('oauthAccessToken_token_idx').on(table.token),
    clientIdIdx: index('oauthAccessToken_clientId_idx').on(table.clientId),
    sessionIdIdx: index('oauthAccessToken_sessionId_idx').on(table.sessionId),
    userIdIdx: index('oauthAccessToken_userId_idx').on(table.userId),
    authorizationCodeIdx: index('oauthAccessToken_authorizationCodeId_idx').on(
      table.authorizationCodeId,
    ),
    refreshIdIdx: index('oauthAccessToken_refreshId_idx').on(table.refreshId),
  }),
)

export const oauthConsent = pgTable(
  'oauthConsent',
  {
    id: text('id').primaryKey(),
    clientId: text('clientId')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    userId: text('userId').references(() => user.id, { onDelete: 'cascade' }),
    referenceId: text('referenceId'),
    resources: jsonb('resources').$type<string[]>(),
    requestedUserInfoClaims: jsonb('requestedUserInfoClaims').$type<string[]>(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
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
    clientIdIdx: index('oauthConsent_clientId_idx').on(table.clientId),
    userIdIdx: index('oauthConsent_userId_idx').on(table.userId),
    userClientIdx: index('oauthConsent_userId_clientId_idx').on(
      table.userId,
      table.clientId,
    ),
  }),
)

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
    expiresAtIdx: index('oauthClientAssertion_expiresAt_idx').on(
      table.expiresAt,
    ),
  }),
)

export const deviceCode = pgTable(
  'deviceCode',
  {
    id: text('id').primaryKey(),
    deviceCode: text('deviceCode').notNull(),
    userCode: text('userCode').notNull(),
    userId: text('userId'),
    expiresAt: timestamp('expiresAt', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    status: text('status').notNull(),
    lastPolledAt: timestamp('lastPolledAt', {
      precision: 3,
      withTimezone: true,
    }),
    pollingInterval: integer('pollingInterval'),
    clientId: text('clientId'),
    scope: text('scope'),
    resources: jsonb('resources').$type<string[]>(),
    oauthClientId: text('oauthClientId'),
  },
  (table) => ({
    deviceCodeUq: uniqueIndex('deviceCode_deviceCode_uidx').on(
      table.deviceCode,
    ),
    userCodeUq: uniqueIndex('deviceCode_userCode_uidx').on(table.userCode),
  }),
)

export const authSchema = {
  user,
  session,
  account,
  verification,
  twoFactor,
  jwks,
  oauthClient,
  oauthResource,
  oauthClientResource,
  oauthRefreshToken,
  oauthAccessToken,
  oauthConsent,
  oauthClientAssertion,
  deviceCode,
}

export const oauthSchema = {
  jwks,
  oauthClient,
  oauthResource,
  oauthClientResource,
  oauthRefreshToken,
  oauthAccessToken,
  oauthConsent,
  oauthClientAssertion,
  deviceCode,
}
