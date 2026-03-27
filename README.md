# One Calendar Monorepo (Turborepo)

## Structure

- `apps/app`: Next.js front-end using Bluesky/AT Protocol session + DID signed requests.
- `apps/ds`: Next.js self-hosted Data Server (DS), PostgreSQL-backed, signature-verified APIs.
- `packages/crypto`: shared signed payload normalization and DID signature verification utilities.
- `packages/types`: shared types for signed payloads and migration bundles.
- `packages/config`: shared TypeScript config.
- `packages/i18n`: shared multilingual strings.

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm db:migrate
```

## Security model

- Front-end does not generate device keys.
- DID signature headers are required on DS APIs: `X-DID`, `X-Timestamp`, `X-Signature`.
- Signed payload format is strict JSON `{ method, path, timestamp, body }`.
- DS resolves DID Document from PLC and verifies signature + 5-minute anti-replay window.
- DS stores ciphertext only and filters by verified DID only.
