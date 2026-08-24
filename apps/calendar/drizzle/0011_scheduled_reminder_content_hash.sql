-- Resend's emails.update accepts ONLY scheduled_at, so a rescheduled email keeps
-- its original subject and body. Editing an event's title/location/description
-- therefore left the queued email stale. Recording a fingerprint of the rendered
-- content lets reconciliation notice a content change and cancel-and-recreate,
-- which is the only way to refresh it.
ALTER TABLE "scheduled_reminders" ADD COLUMN "content_hash" text;
