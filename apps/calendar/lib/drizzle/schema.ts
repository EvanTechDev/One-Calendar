import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  unique,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

import {
  user,
  session,
  account,
  verification,
  twoFactor,
} from '@zntr/auth/schema'

export { user, session, account, verification, twoFactor }

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
    status: text('status').default('confirmed').notNull(),
    color: text('color'),
    categoryId: text('category_id').references(() => calendarCategories.id, {
      onDelete: 'set null',
    }),
    participants: jsonb('participants').$type<
      | string
      | (
          | string
          | { name: string; email?: string | null; userId?: string | null }
        )[]
    >(),
    notificationMinutes: integer('notification_minutes'),
    rrule: text('rrule'),
    exdate: jsonb('exdate').$type<string[]>(),
    seriesId: text('series_id').references(
      (): AnyPgColumn => calendarEvents.id,
      { onDelete: 'cascade' },
    ),
    recurrenceId: text('recurrence_id'),
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
    categoryIdx: index('idx_events_category_id').on(table.categoryId),
    allDayIdx: index('idx_events_is_all_day').on(table.isAllDay),
    statusIdx: index('idx_events_status').on(table.status),
    seriesIdx: index('idx_events_series_id').on(table.seriesId),
    createdAtIdx: index('idx_events_created_at').on(table.createdAt),
    updatedAtIdx: index('idx_events_updated_at').on(table.updatedAt),
    // One override row per (series, occurrence stamp). NULLs are pairwise
    // distinct in Postgres, so master/plain rows (both columns NULL) never
    // conflict.
    seriesRecurrenceUq: uniqueIndex('uq_events_series_recurrence').on(
      table.seriesId,
      table.recurrenceId,
    ),
  }),
)

// --- Settings ---
export const settings = pgTable('calendar_settings', {
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

// --- Event Invites ---
export const eventInvites = pgTable(
  'event_invites',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    status: text('status').notNull().default('pending'),
    inviteToken: text('invite_token').notNull().unique(),
    emailSent: boolean('email_sent').default(false).notNull(),
    addedToCalendar: boolean('added_to_calendar').default(false).notNull(),
    categoryId: text('category_id'),
    expiresAt: timestamp('expires_at', {
      precision: 3,
      withTimezone: true,
    }),
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
    eventIdIdx: index('idx_event_invites_event_id').on(table.eventId),
    emailIdx: index('idx_event_invites_email').on(table.email),
    tokenIdx: index('idx_event_invites_token').on(table.inviteToken),
  }),
)

// ============================================================
// MCP TABLES
// ============================================================

// --- MCP API Keys ---
export const mcpApiKeys = pgTable(
  'mcp_api_keys',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    scopes: jsonb('scopes').notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    lastUsedAt: timestamp('last_used_at', {
      precision: 3,
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_mcp_api_keys_user_id').on(table.userId),
  }),
)

// --- MCP OAuth Tokens ---
export const mcpTokens = pgTable('mcp_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  refreshTokenHash: text('refresh_token_hash'),
  tokenType: text('token_type').notNull().default('bearer'),
  scopes: jsonb('scopes').notNull().default([]),
  clientId: text('client_id').notNull(),
  clientName: text('client_name').notNull(),
  expiresAt: timestamp('expires_at', {
    precision: 3,
    withTimezone: true,
  }).notNull(),
  refreshExpiresAt: timestamp('refresh_expires_at', {
    precision: 3,
    withTimezone: true,
  }),
  isRevoked: boolean('is_revoked').notNull().default(false),
  createdAt: timestamp('created_at', { precision: 3, withTimezone: true })
    .defaultNow()
    .notNull(),
})

// --- MCP Device Codes (for OAuth Device Code Grant) ---
export const mcpDeviceCodes = pgTable('mcp_device_codes', {
  id: text('id').primaryKey(),
  deviceCode: text('device_code').notNull().unique(),
  userCode: text('user_code').notNull().unique(),
  clientId: text('client_id').notNull(),
  clientName: text('client_name').notNull(),
  scopes: jsonb('scopes').notNull().default([]),
  status: text('status').notNull().default('pending'),
  userId: text('user_id').references(() => user.id, {
    onDelete: 'cascade',
  }),
  expiresAt: timestamp('expires_at', {
    precision: 3,
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp('created_at', { precision: 3, withTimezone: true })
    .defaultNow()
    .notNull(),
})

// --- MCP Audit Logs ---
export const mcpAuditLogs = pgTable(
  'mcp_audit_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    authType: text('auth_type').notNull(),
    keyId: text('key_id'),
    action: text('action').notNull(),
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    success: boolean('success').notNull().default(true),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_mcp_audit_user_id').on(table.userId),
    createdAtIdx: index('idx_mcp_audit_created_at').on(table.createdAt),
  }),
)

// --- MCP User Settings ---
export const mcpSettings = pgTable('mcp_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(true),
  rateLimitRpm: integer('rate_limit_rpm').notNull().default(60),
  createdAt: timestamp('created_at', { precision: 3, withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true })
    .defaultNow()
    .notNull(),
})

// --- MCP OAuth Clients (RFC 7591 dynamic registration) ---
export const mcpOauthClients = pgTable('mcp_oauth_clients', {
  id: text('id').primaryKey(),
  clientSecretHash: text('client_secret_hash'),
  clientName: text('client_name').notNull(),
  redirectUris: jsonb('redirect_uris').notNull().default([]),
  grantTypes: jsonb('grant_types')
    .notNull()
    .default(['authorization_code', 'refresh_token']),
  responseTypes: jsonb('response_types').notNull().default(['code']),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method')
    .notNull()
    .default('none'),
  scopes: jsonb('scopes').notNull().default([]),
  isRevoked: boolean('is_revoked').notNull().default(false),
  createdAt: timestamp('created_at', { precision: 3, withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true })
    .defaultNow()
    .notNull(),
})

// --- MCP OAuth Authorization Requests ---
export const mcpAuthRequests = pgTable('mcp_auth_requests', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull(),
  redirectUri: text('redirect_uri'),
  scopes: jsonb('scopes').notNull().default([]),
  codeChallenge: text('code_challenge'),
  codeChallengeMethod: text('code_challenge_method'),
  state: text('state'),
  resource: text('resource'),
  authorizationCode: text('authorization_code').unique(),
  codeExpiresAt: timestamp('code_expires_at', {
    precision: 3,
    withTimezone: true,
  }),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { precision: 3, withTimezone: true })
    .defaultNow()
    .notNull(),
})

// ============================================================
// Relations
// ============================================================

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  twoFactor: one(twoFactor),
  calendarEvents: many(calendarEvents),
  settings: one(settings),
  mcpSettings: one(mcpSettings),
  calendarCategories: many(calendarCategories),
  countdowns: many(countdowns),
  bookmarkedEvents: many(bookmarkedEvents),
  mcpApiKeys: many(mcpApiKeys),
  mcpTokens: many(mcpTokens),
  mcpAuditLogs: many(mcpAuditLogs),
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
    invites: many(eventInvites),
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

export const eventInvitesRelations = relations(eventInvites, ({ one }) => ({
  event: one(calendarEvents, {
    fields: [eventInvites.eventId],
    references: [calendarEvents.id],
  }),
}))

export const mcpApiKeysRelations = relations(mcpApiKeys, ({ one }) => ({
  user: one(user, { fields: [mcpApiKeys.userId], references: [user.id] }),
}))

export const mcpTokensRelations = relations(mcpTokens, ({ one }) => ({
  user: one(user, { fields: [mcpTokens.userId], references: [user.id] }),
}))

export const mcpDeviceCodesRelations = relations(mcpDeviceCodes, ({ one }) => ({
  user: one(user, { fields: [mcpDeviceCodes.userId], references: [user.id] }),
}))

export const mcpAuditLogsRelations = relations(mcpAuditLogs, ({ one }) => ({
  user: one(user, { fields: [mcpAuditLogs.userId], references: [user.id] }),
}))

export const mcpSettingsRelations = relations(mcpSettings, ({ one }) => ({
  user: one(user, { fields: [mcpSettings.userId], references: [user.id] }),
}))

export const mcpAuthRequestsRelations = relations(
  mcpAuthRequests,
  ({ one }) => ({
    user: one(user, {
      fields: [mcpAuthRequests.userId],
      references: [user.id],
    }),
  }),
)
