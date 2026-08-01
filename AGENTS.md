# One Calendar — Agent Guide

## Monorepo structure

pnpm workspace + Turborepo. Package manager: `pnpm@11.5.2`.

```
apps/
  calendar/        Next.js 16 web app (one-calendar) — main product
  calendar-client/ Tauri + React + Vite desktop client
  web/             Astro 7 marketing/site app (@astrojs/react + Tailwind v4)
packages/
  ui/              @zntr/ui — shadcn/ui components (radix-nova style)
  utils/           @zntr/utils — cn(), tailwind-merge, clsx
  i18n/            @zntr/i18n — i18n generation from locale files
```

## Essential commands (run from root)

| Command           | What it does                                     |
| ----------------- | ------------------------------------------------ |
| `pnpm dev`        | Start all dev servers                            |
| `pnpm build`      | Full build (i18n generate → mdx → next build)    |
| `pnpm lint`       | oxlint + eslint via turbo (both run per-package) |
| `pnpm type-check` | `tsc --noEmit` across all packages               |
| `pnpm test`       | `vitest run` across all packages                 |

Single-package: use `pnpm --filter <name> <script>`, e.g. `pnpm --filter one-calendar dev`.

Focused verification: `pnpm lint:check` (no-fix mode) or `pnpm build:check` (build + type-check for one app).

## Linting & formatting

Two linters run sequentially per target: **oxlint** (fast, config at `config/oxlint.json`) then **eslint** (config at `config/eslint.config.ts`). Pre-commit runs `lint-staged` which does prettier → oxlint --fix → eslint --fix.

**Prettier** (root `package.json`): no semi, single quotes, trailing commas, 80 width.

## TypeScript

TypeScript **6.0.3**. `ignoreBuildErrors: true` is set in `next.config.ts` — build does **not** type-check. Run `pnpm type-check` separately. CI runs `pnpm install --frozen-lockfile && pnpm type-check`.

## Testing

Vitest (jsdom). Setup: `vitest-setup.ts` loads `@testing-library/jest-dom/vitest`.  
Run single file: `pnpm --filter one-calendar vitest run path/to/test`.  
Tests live in `__test__/` mirrors of source directories (`engine/`, `hooks/`, `lib/`, `views/`).

## i18n

`packages/i18n/` — source locale JSON + `gen-locales.mjs` script (node, not ts).  
Generate: `pnpm generate:i18n` (must run before build).  
Triggered automatically via turbo `build` task dependency.

## Database

Drizzle ORM + PostgreSQL. Schema at `apps/calendar/lib/drizzle/schema.ts`.  
Migrations in `apps/calendar/drizzle/`. Config at `apps/calendar/drizzle.config.ts`.  
Push schema: `pnpm dlx drizzle-kit push` (dev).  
Generate migrations: `pnpm dlx drizzle-kit generate`.  
Apply: `pnpm dlx drizzle-kit migrate`.  
Requires `POSTGRES_URL` or `DATABASE_URL` env var.

## Auth

Better Auth with drizzle adapter. Config at `apps/calendar/lib/auth.ts` + `lib/auth/`.  
Env vars: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Optional: `BETTER_AUTH_API_KEY`, Turnstile keys.

## Commit conventions

Conventional commits enforced by commitlint (pre-commit hook): `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `revert`. Subject max 100 chars.

## Key quirks

- `next.config.ts` sets `typescript.ignoreBuildErrors: true` — always run `pnpm type-check` separately.
- `tailwind.config.ts` is empty — Tailwind v4 uses `@tailwindcss/postcss` with CSS-based config.
- `prettier` config lives in root `package.json` (no `.prettierrc`). Ignore list in `config/.prettierignore`.
- `tsconfig.json` at root extends to apps; `apps/calendar/tsconfig.json` adds path aliases (`@/*`, `@zntr/*`).
- Component UI library (`@zntr/ui`) uses single-file components at `packages/ui/src/*.tsx` with barrel `index.ts`.
- `calednar-client` is a Tauri desktop app; its `build:tauri` script runs `tsc && vite build`.
- knip config in root `package.json` tracks known dead-code exceptions.
- Vercel cron runs daily via `vercel.json`: `GET /api/blob/check` at midnight UTC.
