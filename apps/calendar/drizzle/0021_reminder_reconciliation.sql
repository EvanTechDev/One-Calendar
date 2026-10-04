-- Keep cancellation receipts after event deletion so failed provider calls can
-- be retried. Never discard or deduplicate a provider receipt in a migration.
ALTER TABLE "scheduled_reminders"
  DROP CONSTRAINT IF EXISTS "scheduled_reminders_event_id_calendar_events_id_fk";
--> statement-breakpoint
ALTER TABLE "scheduled_reminders" ADD COLUMN IF NOT EXISTS "payload" text;
--> statement-breakpoint
ALTER TABLE "scheduled_reminders" ADD COLUMN IF NOT EXISTS "cancel_pending" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reminder_locks" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "expires_at" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
-- Server-only leases: no client-facing policies or anonymous access.
ALTER TABLE "reminder_locks" ENABLE ROW LEVEL SECURITY;
