-- Opt-in email reminders, scheduled through the email provider.
-- See ADR-0010 (email reminders are opt-in per event and scheduled through Resend).

ALTER TABLE "calendar_events" ADD COLUMN "email_reminder" boolean DEFAULT false NOT NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "scheduled_reminders" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "event_id" text NOT NULL,
  "recurrence_id" text,
  "due_at" timestamp(3) with time zone NOT NULL,
  "due_date" text NOT NULL,
  "provider_id" text,
  "sent_at" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "scheduled_reminders"
  ADD CONSTRAINT "scheduled_reminders_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "scheduled_reminders"
  ADD CONSTRAINT "scheduled_reminders_event_id_calendar_events_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "idx_scheduled_reminders_user_date" ON "scheduled_reminders" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_scheduled_reminders_due_at" ON "scheduled_reminders" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "idx_scheduled_reminders_event_id" ON "scheduled_reminders" USING btree ("event_id");--> statement-breakpoint
-- NULLs are pairwise distinct in Postgres, so non-recurring events never collide.
CREATE UNIQUE INDEX "uq_scheduled_reminders_event_stamp" ON "scheduled_reminders" USING btree ("event_id","recurrence_id");
