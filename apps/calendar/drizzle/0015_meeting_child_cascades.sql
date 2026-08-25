-- Sessions, attendance, and retained chat were NEVER deleted: the three child
-- tables had no foreign keys, no cascade, and no explicit delete anywhere in
-- either app. Retained chat (user-authored content) and attendance (participant
-- names) therefore survived meeting deletion, guest-meeting expiry, event
-- deletion, and account deletion — kept forever, and unreachable, because every
-- read path starts from the "meeting" row that no longer exists.
--
-- ADR 0017's no-foreign-key rule is specifically about the CROSS-APP reference
-- "meeting"."event_id" -> "calendar_events": the calendar app owns that table
-- while these tables live in the shared @zntr/meetings package, so the package
-- must not import the calendar's schema. That reasoning does not apply here.
-- These relations are entirely INTERNAL to the package, so they get real
-- database foreign keys and let Postgres do the cascading.
--
-- Orphans predating this migration are removed first, or the constraints cannot
-- be validated.

DELETE FROM "meeting_attendance"
WHERE "session_id" NOT IN (SELECT "id" FROM "meeting_session");--> statement-breakpoint

DELETE FROM "meeting_session"
WHERE "meeting_id" NOT IN (SELECT "id" FROM "meeting");--> statement-breakpoint

DELETE FROM "meeting_chat_message"
WHERE "meeting_id" NOT IN (SELECT "id" FROM "meeting");--> statement-breakpoint

-- A chat message's session is nullable (a message can be retained while no
-- sitting is open), so a dangling reference is nulled rather than deleted: the
-- message itself is still the user's content and still belongs to its meeting.
UPDATE "meeting_chat_message"
SET "session_id" = NULL
WHERE "session_id" IS NOT NULL
  AND "session_id" NOT IN (SELECT "id" FROM "meeting_session");--> statement-breakpoint

ALTER TABLE "meeting_session"
  ADD CONSTRAINT "meeting_session_meeting_id_fk"
  FOREIGN KEY ("meeting_id") REFERENCES "meeting"("id") ON DELETE CASCADE;--> statement-breakpoint

ALTER TABLE "meeting_attendance"
  ADD CONSTRAINT "meeting_attendance_session_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "meeting_session"("id") ON DELETE CASCADE;--> statement-breakpoint

ALTER TABLE "meeting_chat_message"
  ADD CONSTRAINT "meeting_chat_message_meeting_id_fk"
  FOREIGN KEY ("meeting_id") REFERENCES "meeting"("id") ON DELETE CASCADE;--> statement-breakpoint

-- SET NULL, not CASCADE: deleting a sitting must not destroy the chat that
-- happened during it, only the link to it.
ALTER TABLE "meeting_chat_message"
  ADD CONSTRAINT "meeting_chat_message_session_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "meeting_session"("id") ON DELETE SET NULL;
