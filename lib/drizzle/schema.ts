import { pgTable, serial, text, timestamp, boolean, integer, index, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Shares ---
export const shares = pgTable('shares', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  shareId: text('share_id').unique().notNull(),
  encryptedData: text('encrypted_data').notNull(),
  iv: text('iv').notNull(),
  authTag: text('auth_tag').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  isProtected: boolean('is_protected').default(false).notNull(),
  isBurn: boolean('is_burn').default(false).notNull(),
  encVersion: integer('enc_version'),
}, (table) => ({
  userIdIdx: index('idx_shares_user_id').on(table.userId),
}));

// --- Calendar Backups ---
export const calendarBackups = pgTable('calendar_backups', {
  userId: text('user_id').primaryKey(),
  encryptedData: text('encrypted_data').notNull(),
  iv: text('iv').notNull(),
  timestamp: timestamp('timestamp').notNull(),
});

// --- Auth Tables (Better Auth) ---
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  twoFactorEnabled: boolean('two_factor_enabled'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').unique().notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => ({
  accountUnique: uniqueIndex('accounts_provider_id_account_id_key').on(table.providerId, table.accountId),
}));

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export const twoFactor = pgTable('twoFactor', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  verified: boolean('verified').default(false).notNull(),
  userId: text('user_id').unique().notNull().references(() => users.id, { onDelete: 'cascade' }),
});

// --- Relations ---
export const userRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  twoFactor: one(twoFactor),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(users, { fields: [twoFactor.userId], references: [users.id] }),
}));
