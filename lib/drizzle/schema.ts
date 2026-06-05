import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const calendarBackups = pgTable(
  'calendar_backups',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    startDate: timestamp('start_date', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    endDate: timestamp('end_date', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    isAllDay: boolean('is_all_day').default(false).notNull(),
    recurrence: text('recurrence').default('none').notNull(),
    calendarId: text('calendar_id'),
    color: text('color').default('#3b82f6').notNull(),
    encryptedData: text('encrypted_data'),
    iv: text('iv'),
    authTag: text('auth_tag'),
    searchableText: text('searchable_text').default('').notNull(),
    createdAt: timestamp('created_at', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    updatedAt: timestamp('updated_at', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_calendar_backups_user_id').on(table.userId),
    rangeIdx: index('idx_calendar_backups_user_range').on(
      table.userId,
      table.startDate,
      table.endDate,
    ),
    categoryIdx: index('idx_calendar_backups_user_category').on(
      table.userId,
      table.calendarId,
    ),
    searchIdx: index('idx_calendar_backups_user_search').on(
      table.userId,
      table.searchableText,
    ),
  }),
)

export const calendarCategories = pgTable(
  'calendar_categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    keywords: jsonb('keywords').$type<string[]>().default([]).notNull(),
    encryptedData: text('encrypted_data'),
    iv: text('iv'),
    authTag: text('auth_tag'),
    position: integer('position').default(0).notNull(),
    createdAt: timestamp('created_at', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    updatedAt: timestamp('updated_at', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_calendar_categories_user_id').on(table.userId),
  }),
)

export const userSettings = pgTable('user_settings', {
  userId: text('user_id').primaryKey(),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', {
    precision: 3,
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp('updated_at', {
    precision: 3,
    withTimezone: true,
  }).notNull(),
})

export const calendarBookmarks = pgTable(
  'calendar_bookmarks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    eventId: text('event_id').notNull(),
    title: text('title').notNull(),
    startDate: timestamp('start_date', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    endDate: timestamp('end_date', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    color: text('color').default('#3b82f6').notNull(),
    encryptedData: text('encrypted_data'),
    iv: text('iv'),
    authTag: text('auth_tag'),
    createdAt: timestamp('created_at', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    updatedAt: timestamp('updated_at', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_calendar_bookmarks_user_id').on(table.userId),
    eventIdx: index('idx_calendar_bookmarks_user_event').on(
      table.userId,
      table.eventId,
    ),
  }),
)

export const calendarCountdowns = pgTable(
  'calendar_countdowns',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    dueDate: timestamp('due_date', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    eventId: text('event_id'),
    encryptedData: text('encrypted_data'),
    iv: text('iv'),
    authTag: text('auth_tag'),
    createdAt: timestamp('created_at', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    updatedAt: timestamp('updated_at', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_calendar_countdowns_user_id').on(table.userId),
    dueDateIdx: index('idx_calendar_countdowns_user_due').on(
      table.userId,
      table.dueDate,
    ),
  }),
)

export const shares = pgTable(
  'shares',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    shareId: text('share_id').unique().notNull(),
    eventId: text('event_id'),
    passwordHash: text('password_hash'),
    isProtected: boolean('is_protected').default(false).notNull(),
    isBurn: boolean('is_burn').default(false).notNull(),
    expiresAt: timestamp('expires_at', {
      precision: 3,
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    updatedAt: timestamp('updated_at', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_shares_user_id').on(table.userId),
    eventIdIdx: index('idx_shares_event_id').on(table.eventId),
    shareIdIdx: index('idx_shares_share_id').on(table.shareId),
  }),
)

export const user = pgTable('User', {
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

export const session = pgTable('Session', {
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
  'Account',
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

export const verification = pgTable('Verification', {
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

export const twoFactor = pgTable('twoFactor', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backupCodes').notNull(),
  verified: boolean('verified').default(false).notNull(),
  userId: text('userId')
    .unique()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  twoFactor: one(twoFactor),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(user, { fields: [twoFactor.userId], references: [user.id] }),
}))
