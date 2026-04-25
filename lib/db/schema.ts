import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

export const shares = pgTable(
  'shares',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id').notNull(),
    shareId: text('share_id').notNull(),
    encryptedData: text('encrypted_data').notNull(),
    iv: text('iv').notNull(),
    authTag: text('auth_tag').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: false }).notNull(),
    isProtected: boolean('is_protected').notNull().default(false),
    isBurn: boolean('is_burn').notNull().default(false),
    encVersion: integer('enc_version'),
  },
  (table) => ({
    shareIdUnique: uniqueIndex('shares_share_id_key').on(table.shareId),
    userIdIdx: index('idx_shares_user_id').on(table.userId),
  }),
)

export const calendarBackups = pgTable('calendar_backups', {
  userId: text('user_id').primaryKey(),
  encryptedData: text('encrypted_data').notNull(),
  iv: text('iv').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: false }).notNull(),
})

export const atprotoShareBurnReads = pgTable(
  'atproto_share_burn_reads',
  {
    handle: text('handle').notNull(),
    ownerDid: text('owner_did'),
    shareId: text('share_id').notNull(),
    burnedAt: timestamp('burned_at', { withTimezone: false })
      .notNull()
      .defaultNow(),
    pdsDeleteSynced: boolean('pds_delete_synced').notNull().default(false),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.shareId, table.handle] }),
  }),
)
