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
  /**
   * Present only so a reader can tell a Series from a single event. A Series'
   * `start_date` is the recurrence ANCHOR, not the next occurrence, so showing
   * it as "this meeting's time" would be wrong. Expanding occurrences is the
   * calendar app's job (its recurrence engine owns that); this column exists
   * to know when NOT to show a time.
   */
  rrule: text('rrule'),
})
