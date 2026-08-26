-- Tables for @better-auth/oauth-provider and the jwt plugin (ADR 0021, plan 026).
--
-- Every column shape here came from asking the library — `getAuthTables()` with
-- the plugins mounted — rather than from the docs, because two of them are
-- silent traps:
--
-- 1. A `string[]` field maps to **jsonb**, not a Postgres array. A `text[]`
--    column creates cleanly and then fails on every insert the adapter makes.
-- 2. The token, consent, and resource-link foreign keys target
--    "oauthClient"."clientId" and "oauthResource"."identifier", NOT those
--    tables' "id". Pointing them at "id" yields a schema that looks correct and
--    cannot store a token.
--
-- Rehearsed in the isolated auth_test schema (tests/auth/oauth-schema.test.ts)
-- before being applied. Purely additive: no existing table is touched, so this
-- cannot affect the 11 live users.

CREATE TABLE IF NOT EXISTS "jwks" (
  "id" text PRIMARY KEY,
  "publicKey" text NOT NULL,
  "privateKey" text NOT NULL,
  "createdAt" timestamp(3) with time zone NOT NULL DEFAULT now(),
  "expiresAt" timestamp(3) with time zone,
  "alg" text,
  "crv" text
);--> statement-breakpoint

-- A registered OAuth client. `clientId` is the identity every other table joins
-- on, so it carries the unique constraint rather than `id`.
CREATE TABLE IF NOT EXISTS "oauthClient" (
  "id" text PRIMARY KEY,
  "clientId" text NOT NULL UNIQUE,
  "clientSecret" text,
  "clientDiscoveryId" text,
  "disabled" boolean DEFAULT false,
  "skipConsent" boolean,
  "enableEndSession" boolean,
  "subjectType" text,
  "scopes" jsonb,
  -- Fail-closed by design: machine access is never implied by a client's
  -- user-delegated scopes, so this starts empty and an administrator must
  -- assign it explicitly.
  "clientCredentialsScopes" jsonb DEFAULT '[]'::jsonb,
  "userId" text REFERENCES "user"("id") ON DELETE SET NULL,
  "createdAt" timestamp(3) with time zone DEFAULT now(),
  "updatedAt" timestamp(3) with time zone DEFAULT now(),
  "name" text,
  "uri" text,
  "icon" text,
  "contacts" jsonb,
  "tos" text,
  "policy" text,
  "softwareId" text,
  "softwareVersion" text,
  "softwareStatement" text,
  "redirectUris" jsonb NOT NULL,
  "postLogoutRedirectUris" jsonb,
  "backchannelLogoutUri" text,
  "backchannelLogoutSessionRequired" boolean,
  "tokenEndpointAuthMethod" text,
  "applicationType" text,
  "jwks" text,
  "jwksUri" text,
  "grantTypes" jsonb,
  "responseTypes" jsonb,
  "requirePKCE" boolean,
  "dpopBoundAccessTokens" boolean DEFAULT false,
  "referenceId" text,
  "metadata" jsonb
);--> statement-breakpoint

-- A protected resource (an API). Replaces 1.6's `validAudiences` list: each
-- resource carries its own token lifetimes, scopes, and claims.
CREATE TABLE IF NOT EXISTS "oauthResource" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "accessTokenTtl" integer,
  "refreshTokenTtl" integer,
  "signingAlgorithm" text,
  "signingKeyId" text,
  "allowedScopes" jsonb,
  "customClaims" jsonb,
  "dpopBoundAccessTokensRequired" boolean DEFAULT false,
  "disabled" boolean DEFAULT false,
  "createdAt" timestamp(3) with time zone DEFAULT now(),
  "updatedAt" timestamp(3) with time zone DEFAULT now(),
  "policyVersion" integer DEFAULT 1,
  "metadata" jsonb
);--> statement-breakpoint

-- Which client may request tokens for which resource. Cascades on both sides:
-- the link is meaningless once either end is gone.
CREATE TABLE IF NOT EXISTS "oauthClientResource" (
  "id" text PRIMARY KEY,
  "clientId" text NOT NULL
    REFERENCES "oauthClient"("clientId") ON DELETE CASCADE,
  "resourceId" text NOT NULL
    REFERENCES "oauthResource"("identifier") ON DELETE CASCADE,
  "metadata" jsonb,
  "createdAt" timestamp(3) with time zone DEFAULT now()
);--> statement-breakpoint

-- Refresh tokens are created before access tokens because an access token
-- references the refresh token that minted it.
--
-- `sessionId` is ON DELETE SET NULL, not CASCADE: signing out must not erase the
-- record that a token was issued. The plugin marks such tokens revoked, and
-- introspection reports a token whose session ended as inactive — deleting the
-- row instead would destroy that audit trail.
CREATE TABLE IF NOT EXISTS "oauthRefreshToken" (
  "id" text PRIMARY KEY,
  "token" text NOT NULL UNIQUE,
  "clientId" text NOT NULL REFERENCES "oauthClient"("clientId"),
  "sessionId" text REFERENCES "session"("id") ON DELETE SET NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "referenceId" text,
  "authorizationCodeId" text,
  "resources" jsonb,
  "requestedUserInfoClaims" jsonb,
  "expiresAt" timestamp(3) with time zone,
  "createdAt" timestamp(3) with time zone DEFAULT now(),
  "revoked" timestamp(3) with time zone,
  "rotatedAt" timestamp(3) with time zone,
  "rotationReplayResponse" text,
  "rotationReplayExpiresAt" timestamp(3) with time zone,
  "authTime" timestamp(3) with time zone,
  "confirmation" jsonb,
  "scopes" jsonb NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "oauthAccessToken" (
  "id" text PRIMARY KEY,
  -- Nullable: a JWT access token is self-contained and never stored, so only
  -- opaque tokens carry a value here.
  "token" text UNIQUE,
  "clientId" text NOT NULL REFERENCES "oauthClient"("clientId"),
  "sessionId" text REFERENCES "session"("id") ON DELETE SET NULL,
  "userId" text REFERENCES "user"("id") ON DELETE CASCADE,
  "referenceId" text,
  "authorizationCodeId" text,
  "resources" jsonb,
  "requestedUserInfoClaims" jsonb,
  "refreshId" text REFERENCES "oauthRefreshToken"("id") ON DELETE CASCADE,
  "expiresAt" timestamp(3) with time zone,
  "createdAt" timestamp(3) with time zone DEFAULT now(),
  "revoked" timestamp(3) with time zone,
  "confirmation" jsonb,
  "scopes" jsonb NOT NULL
);--> statement-breakpoint

-- What a user has agreed a client may do. Deleting the row is how consent is
-- revoked, so a client deletion cascades.
CREATE TABLE IF NOT EXISTS "oauthConsent" (
  "id" text PRIMARY KEY,
  "clientId" text NOT NULL
    REFERENCES "oauthClient"("clientId") ON DELETE CASCADE,
  "userId" text REFERENCES "user"("id") ON DELETE CASCADE,
  "referenceId" text,
  "resources" jsonb,
  "requestedUserInfoClaims" jsonb,
  "scopes" jsonb NOT NULL,
  "createdAt" timestamp(3) with time zone DEFAULT now(),
  "updatedAt" timestamp(3) with time zone DEFAULT now()
);--> statement-breakpoint

-- Replay protection for private_key_jwt client assertions: a `jti` may be used
-- once, and the row is kept only until the assertion could no longer be valid.
CREATE TABLE IF NOT EXISTS "oauthClientAssertion" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamp(3) with time zone NOT NULL
);--> statement-breakpoint

-- Lookups the provider performs on every token request and every introspection.
CREATE INDEX IF NOT EXISTS "oauthAccessToken_token_idx"
  ON "oauthAccessToken" ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauthAccessToken_sessionId_idx"
  ON "oauthAccessToken" ("sessionId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauthRefreshToken_sessionId_idx"
  ON "oauthRefreshToken" ("sessionId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauthConsent_userId_clientId_idx"
  ON "oauthConsent" ("userId", "clientId");--> statement-breakpoint
-- Swept periodically; the sweep scans by expiry.
CREATE INDEX IF NOT EXISTS "oauthClientAssertion_expiresAt_idx"
  ON "oauthClientAssertion" ("expiresAt");
