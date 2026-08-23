import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
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
    accountUnique: uniqueIndex('Account_providerId_accountId_key').on(
      table.providerId,
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

export const authSchema = {
  user,
  session,
  account,
  verification,
  twoFactor,
}
