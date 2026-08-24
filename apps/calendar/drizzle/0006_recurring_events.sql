ALTER TABLE "calendar_events" ADD COLUMN "rrule" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "exdate" jsonb;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "series_id" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "recurrence_id" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_series_id_calendar_events_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_events_series_id" ON "calendar_events" USING btree ("series_id");