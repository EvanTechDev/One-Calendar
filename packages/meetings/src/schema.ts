import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * A Meeting: a video conference room, stored as its own row. May stand
 * alone (Instant Meeting) or belong to a calendar event (Event Meeting).
 * See docs/adr/0016 — meetings are owned rows.
 *
 * The row id IS the room code (`xxxx-xxxx`).
 */
export const meeting = pgTable(
  'meeting',
  {
    /** The room code, e.g. `ab3k-x9q2`. */
    id: text('id').primaryKey(),
    /**
     * The Organiser when they are a signed-in user. Guest-created
     * Meetings leave this null and carry a Creator Token hash instead.
     * Bare column — the user table belongs to the auth schema.
     */
    organiserId: text('organiser_id'),
    /**
     * SHA-256 hex of the guest Organiser's Creator Token. Holding the
     * raw token is the sole credential for a guest Organiser's authority
     * (ADR 0016). Null for signed-in Organisers.
     */
    creatorTokenHash: text('creator_token_hash'),
    /**
     * The calendar event this Meeting belongs to (Event Meeting), or null
     * (Instant Meeting). Bare text column, no foreign key — the events
     * table belongs to the calendar app; referential integrity is
     * maintained at the application layer (ADR 0017).
     */
    eventId: text('event_id'),
    /** Always 'open' in v1; reserved for invite-only mode (ADR 0019). */
    accessPolicy: text('access_policy').default('open').notNull(),
    /** Server-enforced chat retention policy; false for E2EE Meetings. */
    retainsChat: boolean('retains_chat').default(true).notNull(),
    /**
     * Set by End Meeting, cleared by reopen. An ended Meeting refuses
     * token minting; the link itself never changes (ADR 0016/0019).
     */
    endedAt: timestamp('ended_at', { precision: 3, withTimezone: true }),
    /**
     * Guest Instant Meetings expire 7 days after creation; null means no
     * expiry (signed-in and Event Meetings). See ADR 0018.
     */
    expiresAt: timestamp('expires_at', { precision: 3, withTimezone: true }),
    createdAt: timestamp('created_at', { precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    organiserIdx: index('idx_meeting_organiser').on(table.organiserId),
    eventIdx: index('idx_meeting_event').on(table.eventId),
  }),
)

/**
 * One sitting of a Meeting — from the media server's room_started to
 * room_finished. Webhook-sourced only (ADR 0020).
 */
export const meetingSession = pgTable(
  'meeting_session',
  {
    id: text('id').primaryKey(),
    /**
     * Real foreign key with ON DELETE CASCADE. ADR 0017's no-FK rule concerns
     * only the cross-app `meeting.event_id`; these relations are internal to
     * this package, so Postgres does the cascading. Without it, sittings and
     * their attendance outlived every deletion path and were retained forever,
     * unreachable.
     */
    meetingId: text('meeting_id')
      .notNull()
      .references(() => meeting.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    endedAt: timestamp('ended_at', { precision: 3, withTimezone: true }),
  },
  (table) => ({
    meetingIdx: index('idx_meeting_session_meeting').on(table.meetingId),
  }),
)

/**
 * Attendance: one participant's presence in one sitting — who joined,
 * when, and for how long. Sourced from webhooks, never from the client
 * (ADR 0020).
 */
export const meetingAttendance = pgTable(
  'meeting_attendance',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => meetingSession.id, { onDelete: 'cascade' }),
    participantIdentity: text('participant_identity').notNull(),
    participantName: text('participant_name').notNull(),
    joinedAt: timestamp('joined_at', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    leftAt: timestamp('left_at', { precision: 3, withTimezone: true }),
  },
  (table) => ({
    sessionIdx: index('idx_meeting_attendance_session').on(table.sessionId),
  }),
)

/**
 * Retained Chat: messages persisted for a Meeting's dashboard history.
 * Only meetings without end-to-end encryption retain chat (ADR 0020).
 */
export const meetingChatMessage = pgTable(
  'meeting_chat_message',
  {
    id: text('id').primaryKey(),
    meetingId: text('meeting_id')
      .notNull()
      .references(() => meeting.id, { onDelete: 'cascade' }),
    /**
     * SET NULL rather than CASCADE: deleting a sitting must not destroy the
     * chat that happened during it, only the link back to it.
     */
    sessionId: text('session_id').references(() => meetingSession.id, {
      onDelete: 'set null',
    }),
    senderIdentity: text('sender_identity').notNull(),
    senderName: text('sender_name').notNull(),
    message: text('message').notNull(),
    sentAt: timestamp('sent_at', {
      precision: 3,
      withTimezone: true,
    }).notNull(),
  },
  (table) => ({
    meetingIdx: index('idx_meeting_chat_meeting').on(table.meetingId),
  }),
)

export const meetingsSchema = {
  meeting,
  meetingSession,
  meetingAttendance,
  meetingChatMessage,
}

export type Meeting = typeof meeting.$inferSelect
export type MeetingSession = typeof meetingSession.$inferSelect
export type MeetingAttendance = typeof meetingAttendance.$inferSelect
export type MeetingChatMessage = typeof meetingChatMessage.$inferSelect
