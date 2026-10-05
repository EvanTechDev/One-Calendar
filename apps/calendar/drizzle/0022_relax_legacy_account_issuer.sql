-- Apply before deploying Better Auth 1.7.3+ in calendar and meet. New account
-- writes identify accounts by (providerId, accountId) and omit issuer.
-- Preserve legacy issuer values, account IDs and password hashes.
ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;--> statement-breakpoint

-- Keep Account_providerId_accountId_key: different providers may legitimately
-- use the same accountId, but each provider/account pair must remain unique.
DROP INDEX IF EXISTS "account_issuer_accountId_uidx";
