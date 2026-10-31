-- Better Auth 1.7 identifies an external account by the unique pair
-- ("issuer", "accountId") rather than ("providerId", "accountId"). `providerId`
-- names the local provider CONFIGURATION, which can be renamed or duplicated;
-- the issuer names the authority itself, so two provider configurations
-- pointing at one OIDC authority must share an issuer. `issuer` is required.
--
-- This table holds real users' credentials, so the ordering below is the
-- ordering the 1.7 upgrade guide requires and every step is deliberate:
-- nullable column first (a required column with no default fails on a non-empty
-- table), then backfill, then the NOT NULL, then the index. The guide is
-- explicit that `auth migrate` never emits the NOT NULL step, which is why this
-- migration is hand-written.
--
-- Our data makes this the simplest possible case, verified before writing this:
-- 11 accounts, every one `providerId = 'credential'`, every one already holding
-- `"accountId" = "userId"`, and the post-backfill collision check returned zero
-- rows. So `accountId` is NOT rewritten -- an unnecessary rewrite of a
-- credential identifier is how a user loses the ability to sign in.
--
-- Credential accounts have no external authority, hence the synthetic
-- `local:credential` issuer prescribed by the guide.

ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "issuer" text;--> statement-breakpoint

UPDATE "account"
SET "issuer" = 'local:credential'
WHERE "providerId" = 'credential' AND "issuer" IS NULL;--> statement-breakpoint

-- A row this migration cannot classify must stop the migration rather than be
-- guessed at: an issuer derived from anything other than the authority itself
-- (an email, a display name, a mutable endpoint) is how two identities silently
-- become one. The guide is explicit that the issuer map must be built per
-- deployment, so an unexpected provider is a decision, not a default.
DO $$
DECLARE unclassified integer;
BEGIN
  SELECT count(*) INTO unclassified FROM "account" WHERE "issuer" IS NULL;
  IF unclassified > 0 THEN
    RAISE EXCEPTION
      'account.issuer backfill left % row(s) unclassified; add an explicit issuer rule for their providerId before continuing',
      unclassified;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint

-- The identity key. One external identity maps to exactly one account row.
-- Compound rather than unique on "accountId" alone, so a future social provider
-- can reuse an identifier that a credential account already holds.
CREATE UNIQUE INDEX IF NOT EXISTS "account_issuer_accountId_uidx"
ON "account" ("issuer", "accountId");
