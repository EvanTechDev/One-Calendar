import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Read-only join surface (ADR 0020). The calendar app owns this table
 * (`apps/calendar/lib/drizzle/schema.ts`); never write through this
 * description, never generate migrations from it. Column types must stay
 * mirrored with the owning schema — if `calendar_events` changes there,
 * mirror it here.
 *
 * Deliberately minimal: only the columns the meet dashboard's Upcoming
 * query joins on.
 */
export const readonlyCalendarEvents = pgTable('calendar_events', {
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
})
