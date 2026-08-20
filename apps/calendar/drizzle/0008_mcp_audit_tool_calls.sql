ALTER TABLE "mcp_audit_logs" ADD COLUMN IF NOT EXISTS "entry_type" text DEFAULT 'request' NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_audit_logs" ADD COLUMN IF NOT EXISTS "tool_name" text;--> statement-breakpoint
ALTER TABLE "mcp_audit_logs" ADD COLUMN IF NOT EXISTS "is_mutation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_audit_logs" ADD COLUMN IF NOT EXISTS "changes" jsonb;--> statement-breakpoint
ALTER TABLE "mcp_audit_logs" ADD COLUMN IF NOT EXISTS "duration_ms" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mcp_audit_entry_type" ON "mcp_audit_logs" USING btree ("user_id","entry_type");
