# Zentra Calendar — Agent Guide

## Monorepo structure

pnpm workspace + Turborepo. Package manager: `pnpm@11.5.2`.

```
apps/
  calendar/        Next.js 16 web app (zentra-calendar) — main product
  meet/            Next.js 16 LiveKit video app (zentra-meet), port 3001
  calendar-client/ Tauri + React + Vite desktop client
  web/             Astro 7 marketing/site app (@astrojs/react + Tailwind v4)
packages/
  agent/           @zntr/agent — AI calendar copilot: eve tool defs + AI SDK adapter
  auth/            @zntr/auth — Better Auth adapter, schema, client/server helpers
  meetings/        @zntr/meetings — meeting/session/attendance/chat schema + operations
  ui/              @zntr/ui — shadcn/ui components (radix-nova style)
  utils/           @zntr/utils — cn() (re-exported from the `cn` package), formatDate
  i18n/            @zntr/i18n — i18n generation from locale files
```

Apps never import each other. Code shared between calendar and meet lives in
`packages/*` — that is why `@zntr/meetings` exists (ADR-0017).

## Essential commands (run from root)

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `pnpm dev`        | Start all dev servers                         |
| `pnpm build`      | Full build (i18n generate → mdx → next build) |
| `pnpm lint`       | oxlint via turbo (runs per-package)           |
| `pnpm type-check` | `tsc --noEmit` across all packages            |
| `pnpm test`       | `vitest run` across all packages              |

Single-package: use `pnpm --filter <name> <script>`, e.g. `pnpm --filter zentra-calendar dev`.

Focused verification: `pnpm lint:check` (no-fix mode) or `pnpm build:check` (build + type-check for one app).

## Linting & formatting

**oxlint** is the only linter (config at `config/oxlint.json`). Pre-commit runs `lint-staged` which does prettier → oxlint --fix.

**Prettier** (root `package.json`): no semi, single quotes, trailing commas, 80 width.

## TypeScript

TypeScript **6.0.3**. `ignoreBuildErrors: true` is set in `next.config.ts` — build does **not** type-check. Run `pnpm type-check` separately.

**Nothing type-checks automatically.** `.github/workflows/tsc.yml` runs `pnpm install --frozen-lockfile && pnpm type-check`, but its trigger is `workflow_dispatch:` alone — no `push`, no `pull_request` — so it only runs when someone clicks Run in the Actions tab. Lint and tests have no workflow at all, and no tsconfig covers `tests/**`. Run `pnpm type-check`, `pnpm lint:check` and `pnpm test` before committing anything that could reach `main`.

## Testing

Vitest. Each workspace owns a config; tests live in top-level `tests/<workspace>/`
directories mirroring the source layout:

| Config                               | Tests             | Environment |
| ------------------------------------ | ----------------- | ----------- |
| `apps/calendar/vitest.config.ts`     | `tests/calendar/` | jsdom       |
| `apps/meet/vitest.config.ts`         | `tests/meet/`     | jsdom       |
| `packages/meetings/vitest.config.ts` | `tests/meetings/` | node        |
| `packages/auth/vitest.config.ts`     | `tests/auth/`     | node        |

Setup: `apps/calendar/vitest-setup.ts` / `apps/meet/vitest-setup.ts` load
`@testing-library/jest-dom/vitest`. Add `// @vitest-environment node` at the top
of a jsdom-config test that needs real Node globals (`jose` token signing, for
instance, rejects jsdom's separate-realm `Uint8Array`).

Run single file: `pnpm --filter zentra-calendar vitest run ../../tests/calendar/path/to/test`.

`tests/meetings/fake-db.ts` is an in-memory fake of the drizzle surface
`@zntr/meetings` uses. It evaluates real drizzle conditions and **throws on any
shape it does not recognise** — that is a deliberate stop signal, not a bug to
silence.

## i18n

`packages/i18n/` — source locale JSON + Node scripts `src/gen-locales.mjs` / `src/cleanup-i18n.mjs`.  
Generate: `pnpm generate:i18n` (must run before build).  
Triggered automatically via turbo `build` task dependency.

## Database

Drizzle ORM + PostgreSQL. **One database, shared by both apps.**

Calendar schema at `apps/calendar/lib/drizzle/schema.ts`; meeting tables at
`packages/meetings/src/schema.ts`. Migrations for BOTH live in
`apps/calendar/drizzle/` — the single migration home (ADR-0017). Config at
`apps/calendar/drizzle.config.ts`. Requires `POSTGRES_URL` or `DATABASE_URL`.

Push schema: `pnpm dlx drizzle-kit push` (dev).  
Apply: `pnpm dlx drizzle-kit migrate`.

**`drizzle-kit generate` does not work in this repo** — the `meta/` snapshots
only go to 0002 while 15+ migrations exist, so it prompts for table renames and
hangs. Hand-write new migrations following the style of
`0014_create_meeting_tables.sql`, and mirror the change in the drizzle schema.

`meeting.event_id` has NO foreign key to `calendar_events` on purpose (ADR-0017):
the package must not import the calendar's schema, so that cascade is performed
in application code. The intra-package relations (`meeting_session`,
`meeting_attendance`, `meeting_chat_message`) DO have real FKs with
`ON DELETE CASCADE` — the no-FK rule is only about the cross-app reference.

## Auth

Better Auth with drizzle adapter. Config at `apps/calendar/lib/auth.ts` + `lib/auth/`.  
Env vars: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Optional: `BETTER_AUTH_API_KEY`, Turnstile keys.

Meet has no sign-in surface of its own: it reads the session the calendar
established and links there to authenticate. That requires `AUTH_COOKIE_DOMAIN`
set identically in both apps (both must be subdomains of it) and a
byte-identical `BETTER_AUTH_SECRET`. See `packages/auth/src/cross-app.ts`.

## AI assistant (command palette)

Cmd/Ctrl+K opens an AI command palette (`components/app/ai/ai-command-palette.tsx`,
shadcn cmdk `Command` in `@zntr/ui/command`). Its backend is
`POST /api/agent/chat`: Groq `openai/gpt-oss-120b` via the AI SDK (override
with `GROQ_MODEL`), multi-step tool loop capped
at 8 steps, per-user rate limit 20/5min. Requires `GROQ_API_KEY` (503 without).

Tools are authored ONCE in `packages/agent/src/tools.ts` — plain AI SDK
`tool()`, with a local `defineTool` helper that adds the error boundary
(a thrown tool error is returned as `{ error }` so the model can recover)
and `needsApproval: true` on the two destructive tools — against the
`CalendarToolkit` port (`src/types.ts`). The app binds it with its database
toolkit (`apps/calendar/lib/agent/toolkit.ts`, built from the SAME
`lib/mcp/*-tools.ts` functions the MCP server uses, so the palette and an
external MCP client share cache invalidation and reminder reconciliation).
It does **not** share a path with the REST handler in `app/api/events/route.ts`,
which reimplements the same writes — including `encryptMergedFields`,
`isValidRrule` and `isValidStamp`. Those copies have already drifted: the
route's version handles `participants` and `emailReminder` and the MCP one does
not, so `updateEvent` through the agent silently drops participant changes.
Treat the two as a known split, not a shared abstraction. Tests: `tests/agent/`
(node env).

`packages/agent/src/tools.ts` deliberately lowers through a type-erased
shape: `tool()`'s overloads cannot be satisfied through a generic wrapper
(INPUT collapses to `never`), so the definition is assigned to an erased
local type and `execute` is called with `input as never`.

## Natural-language quick-create

Enter in the create-event popover's TITLE field (create mode only — never
update — and only when `NEXT_PUBLIC_AI_ENABLED === '1'`) sends the
text to `POST /api/agent/parse-event`, which runs ONE `generateObject`
against `parseEventSchema` (`packages/agent/src/parse.ts`), NOT the chat
tool loop. Rate limit 15/min per user (bucket `agent-parse-event`). The
response is a SPARSE draft: any field the text did not state is absent and
the popover keeps the user's value — `sanitizeParsedEvent` drops invalid
fields one by one (field-level degradation) instead of failing the parse,
and a text that yields only a title ("午餐") is still a success.

In `components/app/event/event-editor.tsx`: `applyParsedEvent` merges the
draft (missing `end` shifts the whole event so the current duration is
preserved; a hex colour is mapped to the option whose
`EVENT_BG_TO_ACCENT` matches; `rruleToParts` populates the recurrence
controls inside a try/catch for client-side degradation). While parsing,
the AI-fillable fields render `Skeleton` and the form body is wrapped in
`<fieldset disabled>`. Success shows a toast with an Undo action (the
snapshot taken before parsing); failure leaves the title text untouched and
toasts `aiParseError` / `aiParseRateLimited` (429). Closing the popover
aborts the request silently.

**The title field MUST stay outside the `<form>`.** A text input owned by
a form has Enter as implicit submission, and this editor ends in a
`type="submit"` button — so an in-form title turned Enter into a submit,
which read as "focus jumped to the next field". Cancelling that from
keydown is not dependable; an input with no form owner simply has no
implicit submission. The field is React-controlled (state, never
FormData), so it behaves the same outside a form. It must also stay
MOUNTED while parsing — swapping it for a `Skeleton` unmounts the focused
element, and putting it inside the disabled `fieldset` blurs it; either
one hands focus to the next control.

## Commit conventions

Conventional commits enforced by commitlint (commit-msg hook): `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `revert`. Subject max 100 chars.

## Key quirks

- `next.config.ts` sets `typescript.ignoreBuildErrors: true` — always run `pnpm type-check` separately.
- `tailwind.config.ts` is empty — Tailwind v4 uses `@tailwindcss/postcss` with CSS-based config.
- `prettier` config lives in root `package.json` (no `.prettierrc`). Ignore list in `config/.prettierignore`.
- `tsconfig.json` at root extends to apps; `apps/calendar/tsconfig.json` adds path aliases (`@/*`, `@zntr/*`).
- Vitest config lives in `apps/calendar/vitest.config.ts` (root = the app) but includes top-level `tests/calendar/`. Bare imports from there resolve via the committed symlink `tests/node_modules` → `apps/calendar/node_modules` (pnpm doesn't hoist to the repo root).
- Component UI library (`@zntr/ui`) uses single-file components at `packages/ui/src/*.tsx` with barrel `index.ts`.
- `calendar-client` is a Tauri desktop app; its `build:tauri` script runs `tsc && vite build`.
- knip config in root `package.json` tracks known dead-code exceptions.
- Vercel crons run via `apps/calendar/vercel.json`: `GET /api/blob/check` at midnight UTC (which runs every job in `apps/calendar/lib/maintenance/jobs.ts` — table health, MCP audit retention, expired OAuth state, expired meetings) and `GET /api/reminders/topup` at 2am UTC. `/api/blob/check?jobs=<name>[,<name>]` runs a subset by hand. apps/meet registers no crons: it sweeps expired meetings from the calendar's maintenance run, since the rows are in the same database.
- Recurrence expansion has exactly ONE owner: `apps/calendar/lib/recurrence/engine.ts`. Meet's dashboard reads upcoming meetings from `GET /api/meetings/upcoming` on the calendar rather than re-deriving occurrences, because a series master's `start_date` is its anchor, not an occurrence.
- `apps/meet` needs the calendar's `SALT` to read encrypted event titles. Its `readEventTitle` is a deliberate read-only copy of the calendar's format; if `lib/field-crypto.ts` ever changes, update it in lockstep.
