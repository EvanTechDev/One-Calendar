ALTER TABLE "meeting"
ADD COLUMN "retains_chat" boolean DEFAULT true NOT NULL;

ALTER TABLE "event_invites"
ADD COLUMN "invite_token_hash" text;

CREATE INDEX "idx_event_invites_token_hash"
ON "event_invites" ("invite_token_hash");

CREATE UNIQUE INDEX "uq_event_invites_token_hash_event"
ON "event_invites" ("invite_token_hash", "event_id");
