DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT *
    FROM (
      VALUES
        ('user', 'createdAt'),
        ('user', 'updatedAt'),
        ('session', 'expiresAt'),
        ('session', 'createdAt'),
        ('session', 'updatedAt'),
        ('account', 'accessTokenExpiresAt'),
        ('account', 'refreshTokenExpiresAt'),
        ('account', 'createdAt'),
        ('account', 'updatedAt'),
        ('verification', 'expiresAt'),
        ('verification', 'createdAt'),
        ('verification', 'updatedAt')
    ) AS columns_to_convert(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND information_schema.columns.table_name = target.table_name
        AND information_schema.columns.column_name = target.column_name
        AND data_type = 'timestamp with time zone'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE timestamp(3) without time zone USING %I AT TIME ZONE ''UTC''',
        target.table_name,
        target.column_name,
        target.column_name
      );
    END IF;
  END LOOP;
END
$$;

WITH ranked_consents AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "userId", "clientId"
      ORDER BY "updatedAt" DESC NULLS LAST, "createdAt" DESC NULLS LAST, "id" DESC
    ) AS rank
  FROM "oauthConsent"
  WHERE "userId" IS NOT NULL
)
DELETE FROM "oauthConsent"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_consents
  WHERE rank > 1
);

DROP INDEX IF EXISTS "oauthConsent_userId_clientId_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "oauthConsent_userId_clientId_uidx"
  ON "oauthConsent" ("userId", "clientId");

CREATE INDEX IF NOT EXISTS "deviceCode_expiresAt_idx"
  ON "deviceCode" ("expiresAt");
