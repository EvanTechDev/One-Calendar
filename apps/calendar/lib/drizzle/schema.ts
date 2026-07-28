import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  unique,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// --- User (Table name: "User") ---
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

// --- Session (Table name: "Session") ---
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

// --- Account (Table name: "Account") ---
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

// --- Verification (Table name: "Verification") ---
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

// --- TwoFactor (@@map("twoFactor")) ---
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

// ============================================================
// APP TABLES
// ============================================================

// --- Calendar Events ---
export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    location: text('location'),
    startDate: timestamp('start_date', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    endDate: timestamp('end_date', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    isAllDay: boolean('is_all_day').default(false).notNull(),
    color: text('color'),
    categoryId: text('category_id').references(() => calendarCategories.id, {
      onDelete: 'set null',
    }),
    participants: jsonb('participants'),
    notificationMinutes: integer('notification_minutes'),
    createdAt: timestamp('created_at', {
      precision: 3,
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {
      precision: 3,
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_events_user_id').on(table.userId),
    dateRangeIdx: index('idx_events_date_range').on(
      table.userId,
      table.startDate,
    ),
  }),
)

// --- Settings ---
export const settings = pgTable('settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull().default({}),
  updatedAt: timestamp('updated_at', {
    precision: 3,
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
})

// --- Calendar Categories ---
export const calendarCategories = pgTable(
  'calendar_categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', {
      precision: 3,
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_categories_user_id').on(table.userId),
  }),
)

// --- Countdowns ---
export const countdowns = pgTable(
  'countdowns',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    targetDate: timestamp('target_date', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    repeat: text('repeat').notNull().default('none'),
    description: text('description'),
    color: text('color'),
    icon: text('icon'),
    createdAt: timestamp('created_at', {
      precision: 3,
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_countdowns_user_id').on(table.userId),
  }),
)

// --- Bookmarked Events ---
export const bookmarkedEvents = pgTable(
  'bookmarked_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    eventId: text('event_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', {
      precision: 3,
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userEventUnique: unique('idx_bookmarks_user_event').on(
      table.userId,
      table.eventId,
    ),
    userIdIdx: index('idx_bookmarks_user_id').on(table.userId),
    eventIdIdx: index('idx_bookmarks_event_id').on(table.eventId),
  }),
)

// --- Shares ---
export const shares = pgTable(
  'shares',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    eventId: text('event_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    encryptedPayload: text('encrypted_payload').notNull(),
    hasPassword: boolean('has_password').default(false).notNull(),
    burnAfterRead: boolean('burn_after_read').default(false).notNull(),
    createdAt: timestamp('created_at', {
      precision: 3,
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_shares_user_id').on(table.userId),
    eventIdIdx: index('idx_shares_event_id').on(table.eventId),
  }),
)

// ============================================================
// Relations
// ============================================================

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  twoFactor: one(twoFactor),
  calendarEvents: many(calendarEvents),
  settings: one(settings),
  calendarCategories: many(calendarCategories),
  countdowns: many(countdowns),
  bookmarkedEvents: many(bookmarkedEvents),
  shares: many(shares),
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

export const calendarEventsRelations = relations(
  calendarEvents,
  ({ one, many }) => ({
    user: one(user, {
      fields: [calendarEvents.userId],
      references: [user.id],
    }),
    category: one(calendarCategories, {
      fields: [calendarEvents.categoryId],
      references: [calendarCategories.id],
    }),
    bookmarks: many(bookmarkedEvents),
    shares: many(shares),
  }),
)

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(user, { fields: [settings.userId], references: [user.id] }),
}))

export const calendarCategoriesRelations = relations(
  calendarCategories,
  ({ one, many }) => ({
    user: one(user, {
      fields: [calendarCategories.userId],
      references: [user.id],
    }),
    events: many(calendarEvents),
  }),
)

export const countdownsRelations = relations(countdowns, ({ one }) => ({
  user: one(user, { fields: [countdowns.userId], references: [user.id] }),
}))

export const bookmarkedEventsRelations = relations(
  bookmarkedEvents,
  ({ one }) => ({
    user: one(user, {
      fields: [bookmarkedEvents.userId],
      references: [user.id],
    }),
    event: one(calendarEvents, {
      fields: [bookmarkedEvents.eventId],
      references: [calendarEvents.id],
    }),
  }),
)

export const sharesRelations = relations(shares, ({ one }) => ({
  user: one(user, { fields: [shares.userId], references: [user.id] }),
  event: one(calendarEvents, {
    fields: [shares.eventId],
    references: [calendarEvents.id],
  }),
}))
