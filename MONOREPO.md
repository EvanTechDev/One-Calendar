# Monorepo migration (Turborepo + Bun)

This repository now uses a Bun workspace monorepo with Turborepo.

## Workspace layout

- `apps/web`: existing One Calendar Next.js app (Clerk + PostgreSQL kept as-is).
- `apps/ds`: personal data server (Next.js) for decentralized OAuth + API access.
- `packages/types`: shared TypeScript contracts for web/ds OAuth payloads.
- `packages/ui`: shared UI package placeholder.

## Dual-channel auth model

### Channel A: Clerk user

- Web keeps current Clerk login/session/database flow.
- PostgreSQL access remains inside `apps/web`.

### Channel B: ATProto user via DS

- Web starts OAuth via `POST /api/ds/oauth/start`, generates `state` + PKCE (`S256`) and redirects user to `${ds}/oauth/authorize`.
- DS validates `client_id` metadata and exact `redirect_uri` match.
- DS issues one-time `authorization_code` (5 minutes) and redirects back with `code` + `state`.
- Web callback exchanges `code` + `code_verifier` at DS `/oauth/token`.
- DS returns ES256 JWTs: access token (`1h`) + refresh token (`30d`).
- DS API endpoints verify JWT signature and grant record binding (`did + client_id`).

## Security defaults enforced

- PKCE verifier length: `43-128`.
- PKCE challenge method: only `S256`.
- Strict `redirect_uri` allowlist matching from client metadata.
- Authorization code is one-time and deleted after exchange.
- Access token lifetime: 3600 seconds.
- Refresh token lifetime: 30 days.
- ES256 key pair loaded from env, fallback to runtime-generated key pair at startup.

## Run

```bash
bun install
bun run dev
```

Turborepo runs both apps (if configured scripts are available in each workspace).
