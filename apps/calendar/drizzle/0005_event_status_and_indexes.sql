ALTER TABLE "calendar_events" ADD COLUMN "status" text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_events_category_id" ON "calendar_events" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_events_is_all_day" ON "calendar_events" USING btree ("is_all_day");--> statement-breakpoint
CREATE INDEX "idx_events_status" ON "calendar_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_events_created_at" ON "calendar_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_events_updated_at" ON "calendar_events" USING btree ("updated_at");