-- Preserve the readable name of the API key or OAuth client used for each call.
ALTER TABLE "mcp_audit_logs"
  ADD COLUMN IF NOT EXISTS "identity_name" text;
