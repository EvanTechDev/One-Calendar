CREATE TABLE IF NOT EXISTS "deviceCode" (
  "id" text PRIMARY KEY,
  "deviceCode" text NOT NULL,
  "userCode" text NOT NULL,
  "userId" text,
  "expiresAt" timestamp(3) with time zone NOT NULL,
  "status" text NOT NULL,
  "lastPolledAt" timestamp(3) with time zone,
  "pollingInterval" integer,
  "clientId" text,
  "scope" text,
  "resources" jsonb,
  "oauthClientId" text
);

CREATE UNIQUE INDEX IF NOT EXISTS "deviceCode_deviceCode_uidx"
  ON "deviceCode" ("deviceCode");
CREATE UNIQUE INDEX IF NOT EXISTS "deviceCode_userCode_uidx"
  ON "deviceCode" ("userCode");

CREATE INDEX IF NOT EXISTS "oauthClient_userId_idx"
  ON "oauthClient" ("userId");
CREATE INDEX IF NOT EXISTS "oauthClientResource_clientId_idx"
  ON "oauthClientResource" ("clientId");
CREATE INDEX IF NOT EXISTS "oauthClientResource_resourceId_idx"
  ON "oauthClientResource" ("resourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "oauthClientResource_clientId_resourceId_uidx"
  ON "oauthClientResource" ("clientId", "resourceId");

CREATE INDEX IF NOT EXISTS "oauthRefreshToken_clientId_idx"
  ON "oauthRefreshToken" ("clientId");
CREATE INDEX IF NOT EXISTS "oauthRefreshToken_userId_idx"
  ON "oauthRefreshToken" ("userId");
CREATE INDEX IF NOT EXISTS "oauthRefreshToken_authorizationCodeId_idx"
  ON "oauthRefreshToken" ("authorizationCodeId");

CREATE INDEX IF NOT EXISTS "oauthAccessToken_clientId_idx"
  ON "oauthAccessToken" ("clientId");
CREATE INDEX IF NOT EXISTS "oauthAccessToken_userId_idx"
  ON "oauthAccessToken" ("userId");
CREATE INDEX IF NOT EXISTS "oauthAccessToken_authorizationCodeId_idx"
  ON "oauthAccessToken" ("authorizationCodeId");
CREATE INDEX IF NOT EXISTS "oauthAccessToken_refreshId_idx"
  ON "oauthAccessToken" ("refreshId");

CREATE INDEX IF NOT EXISTS "oauthConsent_clientId_idx"
  ON "oauthConsent" ("clientId");
CREATE INDEX IF NOT EXISTS "oauthConsent_userId_idx"
  ON "oauthConsent" ("userId");
