CREATE TABLE IF NOT EXISTS "mcp_api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"refresh_token_hash" text,
	"token_type" text DEFAULT 'bearer' NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"refresh_expires_at" timestamp (3) with time zone,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_device_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"device_code" text NOT NULL,
	"user_code" text NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_id" text,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"auth_type" text NOT NULL,
	"key_id" text,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"ip_address" text,
	"user_agent" text,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_rpm" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_api_keys" ADD CONSTRAINT "mcp_api_keys_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_device_codes" ADD CONSTRAINT "mcp_device_codes_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_audit_logs" ADD CONSTRAINT "mcp_audit_logs_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_settings" ADD CONSTRAINT "mcp_settings_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_tokens_token_hash_unique" ON "mcp_tokens" ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_device_codes_device_code_unique" ON "mcp_device_codes" ("device_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_device_codes_user_code_unique" ON "mcp_device_codes" ("user_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mcp_api_keys_user_id" ON "mcp_api_keys" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mcp_audit_user_id" ON "mcp_audit_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mcp_audit_created_at" ON "mcp_audit_logs" ("created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_auth_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"client_id" text NOT NULL,
	"redirect_uri" text,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"code_challenge" text,
	"code_challenge_method" text,
	"state" text,
	"resource" text,
	"authorization_code" text,
	"code_expires_at" timestamp (3) with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_auth_requests" ADD CONSTRAINT "mcp_auth_requests_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_auth_requests_authorization_code_unique" ON "mcp_auth_requests" ("authorization_code");
