-- Per-occurrence participant visibility and RSVP for recurring events.
-- See ADR-0005 (participant visibility is a baseline range plus per-stamp exceptions).

-- Baseline visible range on the invite. 'all' with both stamps NULL is the
-- pre-existing behaviour (the whole event), so existing rows keep working.
-- 'none' means "exceptions only" and must never be confused with unbounded.
ALTER TABLE "event_invites" ADD COLUMN "baseline_kind" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_invites" ADD COLUMN "from_stamp" text;--> statement-breakpoint
ALTER TABLE "event_invites" ADD COLUMN "until_stamp" text;--> statement-breakpoint

-- De-duplicate before adding the uniqueness that application code assumed but
-- never enforced; concurrent adds could previously double-invite one email.
-- Emails are stored already lower-cased by createInvitesForEvent, but older rows
-- may not be, so normalise first and compare on the stored value the index uses.
UPDATE "event_invites" SET "email" = lower("email") WHERE "email" <> lower("email");--> statement-breakpoint
DELETE FROM "event_invites" a USING "event_invites" b
WHERE a."event_id" = b."event_id"
  AND a."email" = b."email"
  AND a."created_at" > b."created_at";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_event_invites_event_email" ON "event_invites" USING btree ("event_id","email");--> statement-breakpoint

-- A series split copies a grant to the new master keeping the same token, so the
-- participant's link survives the organiser's edit (ADR-0009). That makes a
-- globally-unique token impossible; uniqueness moves to (token, event).
ALTER TABLE "event_invites" DROP CONSTRAINT IF EXISTS "event_invites_invite_token_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_event_invites_token_event" ON "event_invites" USING btree ("invite_token","event_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "event_invite_occurrences" (
  "id" text PRIMARY KEY NOT NULL,
  "invite_id" text NOT NULL,
  "recurrence_id" text NOT NULL,
  "visible" boolean NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "event_invite_occurrences"
  ADD CONSTRAINT "event_invite_occurrences_invite_id_event_invites_id_fk"
  FOREIGN KEY ("invite_id") REFERENCES "public"."event_invites"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "idx_invite_occurrences_invite_id" ON "event_invite_occurrences" USING btree ("invite_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invite_occurrences_invite_stamp" ON "event_invite_occurrences" USING btree ("invite_id","recurrence_id");
