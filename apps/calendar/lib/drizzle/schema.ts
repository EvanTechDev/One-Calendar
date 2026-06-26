import { pgTable, serial, text, timestamp, boolean, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Share (@@map("shares")) ---
export const shares = pgTable('shares', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  shareId: text('share_id').unique().notNull(),
  encryptedData: text('encrypted_data').notNull(),
  iv: text('iv').notNull(),
  authTag: text('auth_tag').notNull(),
  timestamp: timestamp('timestamp', { precision: 3, withTimezone: true }).notNull(),
  isProtected: boolean('is_protected').default(false).notNull(),
  isBurn: boolean('is_burn').default(false).notNull(),
  encVersion: integer('enc_version'),
}, (table) => ({
  userIdIdx: index('idx_shares_user_id').on(table.userId),
}));

// --- CalendarBackup (@@map("calendar_backups")) ---
export const calendarBackups = pgTable('calendar_backups', {
  userId: text('user_id').primaryKey(),
  encryptedData: text('encrypted_data').notNull(),
  iv: text('iv').notNull(),
  timestamp: timestamp('timestamp', { precision: 3, withTimezone: true }).notNull(),
});

// --- User (Table name: "User") ---
export const user = pgTable('User', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  image: text('image'),
  twoFactorEnabled: boolean('twoFactorEnabled'),
  createdAt: timestamp('createdAt', { precision: 3, withTimezone: true }).notNull(),
  updatedAt: timestamp('updatedAt', { precision: 3, withTimezone: true }).notNull(),
});

// --- Session (Table name: "Session") ---
export const session = pgTable('Session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { precision: 3, withTimezone: true }).notNull(),
  token: text('token').unique().notNull(),
  createdAt: timestamp('createdAt', { precision: 3, withTimezone: true }).notNull(),
  updatedAt: timestamp('updatedAt', { precision: 3, withTimezone: true }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

// --- Account (Table name: "Account") ---
export const account = pgTable('Account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { precision: 3, withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { precision: 3, withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { precision: 3, withTimezone: true }).notNull(),
  updatedAt: timestamp('updatedAt', { precision: 3, withTimezone: true }).notNull(),
}, (table) => ({
  accountUnique: uniqueIndex('Account_providerId_accountId_key').on(table.providerId, table.accountId),
}));

// --- Verification (Table name: "Verification") ---
export const verification = pgTable('Verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { precision: 3, withTimezone: true }).notNull(),
  createdAt: timestamp('createdAt', { precision: 3, withTimezone: true }),
  updatedAt: timestamp('updatedAt', { precision: 3, withTimezone: true }),
});

// --- TwoFactor (@@map("twoFactor")) ---
export const twoFactor = pgTable('twoFactor', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backupCodes').notNull(),
  verified: boolean('verified').default(false).notNull(),
  userId: text('userId').unique().notNull().references(() => user.id, { onDelete: 'cascade' }),
});

// --- Relations ---
export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  twoFactor: one(twoFactor),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(user, { fields: [twoFactor.userId], references: [user.id] }),
}));
