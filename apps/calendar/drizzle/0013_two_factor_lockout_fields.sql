-- better-auth >= 1.6.22 added account lockout to the two-factor plugin. Its
-- twoFactor model now includes "failedVerificationCount" and "lockedUntil",
-- which the drizzle adapter validates against our schema on every write.
-- Without these columns, enabling 2FA and verifying TOTP both throw
-- ("The field ... does not exist in the twoFactor Drizzle schema"),
-- making 2FA unusable.
ALTER TABLE "two_factor"
  ADD COLUMN IF NOT EXISTS "failedVerificationCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

ALTER TABLE "two_factor"
  ADD COLUMN IF NOT EXISTS "lockedUntil" timestamp (3) with time zone;
