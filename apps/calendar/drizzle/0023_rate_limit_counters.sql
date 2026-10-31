-- Fixed-window rate limit counters, replacing the Redis counters that backed
-- them. One row per (name, subject, window start): the primary key makes the
-- increment a single atomic INSERT ... ON CONFLICT DO UPDATE, so concurrent
-- requests in different function instances cannot both read the same count and
-- both let themselves through.
--
-- "bucket_key" is the three parts joined with "|". The column is opaque here;
-- the composition lives in checkFixedWindowLimit in @zntr/auth/rate-limit, which
-- explains why "|" rather than a colon.
--
-- "window_start" is the first second of the window, computed by the caller from
-- its own clock rather than stored as a bucket number, so the row is readable
-- and debuggable. "expires_at" is what the cleanup job in
-- lib/maintenance/jobs.ts deletes on; there is no TTL on the server side.
CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
  "bucket_key" text PRIMARY KEY NOT NULL,
  "window_start" timestamp (3) with time zone NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rate_limit_counters_expires_at"
  ON "rate_limit_counters" ("expires_at");
--> statement-breakpoint
-- Server-only counters: no client-facing policies and no anonymous access.
ALTER TABLE "rate_limit_counters" ENABLE ROW LEVEL SECURITY;
