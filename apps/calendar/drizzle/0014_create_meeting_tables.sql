-- Meetings become owned, persisted rows (docs/adr/0016-0020). Until now a
-- Zentra Meet room was only a string in a URL, so the token endpoint minted
-- join credentials for any room name an anonymous visitor asked for, and a
-- calendar event had nothing to attach a meeting to.
--
-- The row id IS the room code ("xxxx-xxxx"). "organiser_id" carries a
-- signed-in Organiser; guest-created meetings leave it null and store the
-- SHA-256 of a Creator Token instead. "event_id" references
-- "calendar_events" WITHOUT a foreign key on purpose (ADR 0017): the table
-- is owned by the calendar app's schema while these tables live in the
-- shared @zntr/meetings package, so the cascade is performed by the
-- application's event-deletion path.

CREATE TABLE IF NOT EXISTS "meeting" (
  "id" text PRIMARY KEY NOT NULL,
  "organiser_id" text,
  "creator_token_hash" text,
  "event_id" text,
  "access_policy" text DEFAULT 'open' NOT NULL,
  "ended_at" timestamp (3) with time zone,
  "expires_at" timestamp (3) with time zone,
  "created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_meeting_organiser" ON "meeting" ("organiser_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meeting_event" ON "meeting" ("event_id");--> statement-breakpoint

-- One sitting of a meeting, written from the media server's room_started /
-- room_finished webhooks. Duration and attendance are never client-reported
-- (ADR 0020).
CREATE TABLE IF NOT EXISTS "meeting_session" (
  "id" text PRIMARY KEY NOT NULL,
  "meeting_id" text NOT NULL,
  "started_at" timestamp (3) with time zone NOT NULL,
  "ended_at" timestamp (3) with time zone
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_meeting_session_meeting" ON "meeting_session" ("meeting_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "meeting_attendance" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "participant_identity" text NOT NULL,
  "participant_name" text NOT NULL,
  "joined_at" timestamp (3) with time zone NOT NULL,
  "left_at" timestamp (3) with time zone
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_meeting_attendance_session" ON "meeting_attendance" ("session_id");--> statement-breakpoint

-- Retained Chat. Only meetings without end-to-end encryption persist chat;
-- an encrypted meeting's chat never reaches the server (ADR 0020).
CREATE TABLE IF NOT EXISTS "meeting_chat_message" (
  "id" text PRIMARY KEY NOT NULL,
  "meeting_id" text NOT NULL,
  "session_id" text,
  "sender_identity" text NOT NULL,
  "sender_name" text NOT NULL,
  "message" text NOT NULL,
  "sent_at" timestamp (3) with time zone NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_meeting_chat_meeting" ON "meeting_chat_message" ("meeting_id");
