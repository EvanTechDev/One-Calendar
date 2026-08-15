CREATE TABLE "event_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invite_token" text NOT NULL,
	"added_to_calendar" boolean DEFAULT false NOT NULL,
	"category_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_invites_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
ALTER TABLE "event_invites" ADD CONSTRAINT "event_invites_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_event_invites_event_id" ON "event_invites" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_event_invites_email" ON "event_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_event_invites_token" ON "event_invites" USING btree ("invite_token");
