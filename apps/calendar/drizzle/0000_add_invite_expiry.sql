-- Placeholder migration for plan 004 (invite expiry).
-- drizzle-kit generate must be run later to produce the official migration
-- + snapshot; this file is the hand-written equivalent:
--   ALTER TABLE "event_invites" ADD COLUMN "expires_at" timestamp(3) with time zone;
ALTER TABLE "event_invites" ADD COLUMN "expires_at" timestamp(3) with time zone;
