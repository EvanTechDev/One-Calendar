DELETE FROM "calendar_events" a USING "calendar_events" b
WHERE a."series_id" IS NOT NULL AND a."series_id" = b."series_id"
  AND a."recurrence_id" IS NOT NULL AND a."recurrence_id" = b."recurrence_id"
  AND a."user_id" = b."user_id"
  AND a."created_at" > b."created_at";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_events_series_recurrence" ON "calendar_events" USING btree ("series_id","recurrence_id");
