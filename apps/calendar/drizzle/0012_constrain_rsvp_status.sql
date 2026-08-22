-- RSVP status was validated only in zod, so anything reaching the database by
-- another path could store an arbitrary string. The UI compares against exact
-- values, so a stray one renders as "no answer" with no way to tell why.
ALTER TABLE "event_invites"
  ADD CONSTRAINT "event_invites_status_check"
  CHECK ("status" IN ('pending', 'accepted', 'maybe', 'declined'));--> statement-breakpoint

ALTER TABLE "event_invite_occurrences"
  ADD CONSTRAINT "event_invite_occurrences_status_check"
  CHECK ("status" IN ('pending', 'accepted', 'maybe', 'declined'));
