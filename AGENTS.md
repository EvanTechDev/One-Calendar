# Zentra Calendar — Agent Guide

## Agent skills

### Issue tracker

Track specifications and implementation work in Linear: Core team, Zentra
Calendar project. Record scope and verification results on the issue and keep its
status current.

### Triage labels

Use the default triage labels: `ready-for-agent`, `ready-for-human`, `needs-info`,
`needs-triage`, and `wontfix`.

## Monorepo structure

Bun workspace. Package manager: `bun@1.4.4` (declared in `package.json`).

```
apps/
  calendar/        Next.js 16 web app (zentra-calendar) — main product
  meet/            Next.js 16 LiveKit video app (zentra-meet), port 3001
  calendar-client/ Tauri + React + Vite desktop client
  web/             Astro 7 marketing/site app (@astrojs/react + Tailwind v4)
packages/
  calendar/        @zntr/calendar — shared product UI, state, recurrence and host interface
  agent/           @zntr/agent — AI calendar copilot: eve tool defs + AI SDK adapter
  auth/            @zntr/auth — Better Auth adapter, schema, client/server helpers
  meetings/        @zntr/meetings — meeting/session/attendance/chat schema + operations
  ui/              @zntr/ui — shadcn/ui components (radix-nova style)
  utils/           @zntr/utils — cn() (re-exported from the `cn` package), formatDate
  i18n/            @zntr/i18n — i18n generation from locale files
docs/              @zntr/docs — Next.js + Fumadocs user documentation, port 3002
```

Apps never import each other. Code shared between calendar and meet lives in
`packages/*` — that is why `@zntr/meetings` exists.

Calendar source stays directly under its workspace root, without a `src/` wrapper:

- `apps/calendar/app/`: Next.js routes, layouts and API handlers; keep URLs stable.
- `apps/calendar/features/`: business modules (`auth`, `account`, `events`,
  `bookmarks`, `meetings`, `invites`, `reminders`, `agent`, `mcp`). Keep feature-owned
  components beside their logic.
- `apps/calendar/components/`: app shell and landing page, not shared product UI.
- `apps/calendar/lib/`: infrastructure (database, mail, crypto, logging and jobs).
- `apps/calendar/drizzle/`: the single migration home for both apps.
- `packages/calendar/`: `components/`, `hooks/`, `lib/`, `host/`, `assets/`, and
  `styles.css`. Web and desktop consume this package; generic primitives stay in
  `@zntr/ui`, and generic utilities stay in `@zntr/utils`.
- `tests/calendar/`: mirrors Calendar's route, feature and infrastructure ownership.

`docs/` is the user documentation website, not an engineering documentation tree.
Existing Astro, desktop and generic package source layouts are unchanged.

## Essential commands (run from root)

| Command              | What it does                                             |
| -------------------- | -------------------------------------------------------- |
| `bun run dev`        | Start all dev servers in parallel                        |
| `bun run build`      | Generate i18n, then build workspaces in dependency order |
| `bun run lint`       | Run oxlint in each workspace                             |
| `bun run type-check` | Run each workspace's type check                          |
| `bun run test`       | Run tests in workspaces that define a test script        |

Root scripts use `bun run --sequential --workspaces --if-present`; the root is excluded to avoid
recursion. Builds and checks run one workspace at a time to bound resource use;
development servers use `--parallel`. Workspaces without a script are skipped.
The calendar's own build script generates i18n before `next build`.
Builds use `scripts/workspaces.mjs` to visit dependencies first: Bun's
`--sequential` runner alone orders by name, not dependency order.

Single-package: use `bun run --filter <name> <script>`, e.g. `bun run --filter zentra-calendar dev`.

Docs: `bun run --filter @zntr/docs type-check` generates MDX and route types before
checking TypeScript; `lint:check` uses the shared oxlint config. User-facing
content lives in `docs/content/docs/`; keep behavior claims aligned with the
source map in `docs/README.md` under Content guide.

Focused verification: `bun run lint:check` (no-fix mode) or `bun run --filter <app> build:check`.

Bun manages installation and workspace orchestration in both runtime modes.
`bun run runtime:node` switches Calendar/Meet Next.js to Node without replacing
Bun as the package manager; `bun run runtime:bun` switches them back. Keep Node
25 available for Node-shebang framework tooling. Checks and tests use native
`bun check` and `bun test --isolate`; there is no Vitest runner.
Use `bun install --frozen-lockfile` in CI. Only sharp and esbuild are trusted to
run dependency lifecycle scripts.

## Linting & formatting

**oxlint** is the only linter (config at `config/oxlint.json`). Pre-commit runs `lint-staged` which does `bun fmt` → oxlint --fix.

**Bun formatter** (`[fmt]` in root `bunfig.toml`): no semi, single quotes, trailing commas, 80 width.
Run `bun run format` to write or `bun run format:check` to check without writing.
Astro files are not supported by the native formatter and are left unchanged.

## TypeScript

Bun's native TypeScript checker (`bun check`) follows the root project references.
`ignoreBuildErrors: true` is set in `next.config.ts` — build does **not** type-check.
Run `bun check` separately. Workspace checks also generate required framework types.

**Checks are manually triggered.** `.github/workflows/tsc.yml` installs with the
frozen lockfile and runs `bun run type-check`, `bun run lint:check`, and `bun run test`.
Its only trigger is `workflow_dispatch` — no `push` or `pull_request`. An optional
calendar test path and `focused_only` mode support remote red-green cycles.
Application project references do not cover `tests/**`. Run `bun run type-check`, `bun run lint:check`, and
`bun run test` before committing anything that could reach `main`; a focused green
run is not the full validation gate.
The docs website's type-check command generates its MDX collections first.

## Testing

Tests use `bun:test` and live in top-level `tests/<workspace>/` directories
mirroring source layout. Run `bun test --isolate` to isolate globals and module
mocks between files. Browser tests explicitly await `tests/support/dom.ts`
before importing React or Testing Library; other tests keep Bun's native globals.
The DOM setup retains native crypto, fetch and typed arrays for auth and API tests.
Register `mock.module` before dynamically importing the module under test; Bun
does not hoist mocks. Partial mocks capture the original module before registration.

Run one file: `bun test --isolate ./tests/calendar/path/to/test.test.ts`.

`tests/meetings/fake-db.ts` is an in-memory fake of the drizzle surface
`@zntr/meetings` uses. It evaluates real drizzle conditions and **throws on any
shape it does not recognise** — that is a deliberate stop signal, not a bug to
silence.

### Database-backed tests

`tests/auth/` talks to a real Postgres. Without a URL the suite skips, so
`databaseIsAvailable()` decides the run at collection time — condition a
`describe` on that, never on a connection opened in `beforeAll`, or it skips
unconditionally on every machine.

`tests/auth/db-harness.ts` confines every statement to the `auth_test` schema by
**wrapping the `pg.Client`** in a `Proxy` whose `query` runs the statement
between `begin; set local search_path …` and `commit`, serialised through a
promise chain. Pin at the client boundary rather than at each call site:
drizzle holds the client, so a call-site wrapper leaves `db.query` unpinned.
Holding a transaction is what pins the backend, which is why this works against
the transaction-mode pooler the app itself uses — a session `SET` belongs to the
backend and the next client gets it back unset. The cost is three round trips
per statement, which is why these tests take minutes rather than seconds.

Point `AUTH_TEST_POSTGRES_URL` at a **disposable** database. The harness
truncates the tables it owns and `connectUnpinned` is free to poison its own
path; the schema it creates is `auth_test`, but nothing stops a test from
reaching past it if the pin is ever removed.

## i18n

`packages/i18n/` — source locale JSON + Node scripts `src/gen-locales.mjs` / `src/cleanup-i18n.mjs`.  
Generate: `bun run generate:i18n` (must run before build).
The root `build` script generates locales before building the workspaces. The
calendar's build script also generates them when building that app directly.

## Database

Drizzle ORM + PostgreSQL. **One database, shared by both apps.**

Calendar schema at `apps/calendar/lib/drizzle/schema.ts`; meeting tables at
`packages/meetings/src/schema.ts`. Migrations for BOTH live in
`apps/calendar/drizzle/` — the single migration home (ADR-0017). Config at
`apps/calendar/drizzle.config.ts`. Requires `POSTGRES_URL` or `DATABASE_URL`.

Push schema: `bun x --no-install drizzle-kit push` (dev).
Apply: `bun x --no-install drizzle-kit migrate`.

**`drizzle-kit generate` does not work in this repo** — the `meta/` snapshots
only go to 0002 while 15+ migrations exist, so it prompts for table renames and
hangs. Hand-write new migrations following the style of
`0014_create_meeting_tables.sql`, and mirror the change in the drizzle schema.

`meeting.event_id` has NO foreign key to `calendar_events` on purpose (ADR-0017):
the package must not import the calendar's schema, so that cascade is performed
in application code. The intra-package relations (`meeting_session`,
`meeting_attendance`, `meeting_chat_message`) DO have real FKs with
`ON DELETE CASCADE` — the no-FK rule is only about the cross-app reference.

### Rate limiting

There is no Redis. Fixed-window budgets are counted in the `rate_limit_counters`
table, one row per `(budget, subject, window start)`, incremented by a single
`INSERT … ON CONFLICT DO UPDATE`. The primary key IS the atomicity guarantee:
a read-then-write would lose increments under concurrency, which is exactly the
bug the Redis implementation had. `count` is set to `1` on insert **and**
incremented on conflict — the insert branch is the first request of a window, so
leaving it at the column default makes every budget one request too generous.

Table: `packages/auth/src/rate-limit-table.ts` (it is in `@zntr/auth` because the
two apps share one database and cannot import each other's schema). Logic:
`@zntr/auth/rate-limit`. Each app binds it to its own handle in
`lib/rate-limit.ts`; the MCP limiter keeps counting `mcp_audit_logs` rows
instead. Rows are swept by the `rateLimitCounters` maintenance job, not by TTL.

`bucket_key` is `name|subject|windowStart` and the separator is load-bearing.
Names are already composite (`auth:sign-in/email:global`) and subjects are
attacker-controlled on the IP-keyed budgets, so a colon would let
`auth:sign-in/email` + `global:all` and `auth:sign-in/email:global` + `all`
address one row — one client spending the shared sign-in budget. Build a key
through `bucketKey()` in `@zntr/auth/rate-limit`, never by hand.

### Typing a database handle

**Never write `ReturnType<typeof drizzle>`.** `drizzle`'s schema parameter
defaults to `Record<string, never>`, which trips drizzle's own guard in
`PgDatabase` and makes the handle's `query` a `DrizzleTypeError`. The result is
that the "loose" type is the only one a real schema-bound handle is _not_
assignable to, so every call site fails to type-check.

Write `NodePgDatabase<Record<string, unknown>>` (plus
`NodePgTransaction<Record<string, unknown>, Record<string, never>>` where a
transaction is also accepted) instead — see `Db` in `@zntr/meetings/src/db.ts`,
`Db` in `@zntr/auth/rate-limit.ts`, and `EventWriteDb` in
`apps/calendar/features/events/write.ts`. Widening the schema argument to `unknown`
keeps `query` real while still accepting every handle.

## Auth

Better Auth with drizzle adapter. Config at `apps/calendar/features/auth/index.ts`;
app-owned auth helpers and components live alongside it in `features/auth/`.
Env vars: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Optional: `BETTER_AUTH_API_KEY`.
Browser credential and mail-sending routes use Vercel BotID Basic. Both apps
initialize its client in `instrumentation-client.ts`. Auth routes are verified
by Better Auth's `captcha` plugin (`vercel-botid` provider), enabled with
`plugins.botId` in `createAuth` (`botIdPlugin` in `@zntr/auth/bot-id`); shared
paths live in `@zntr/auth/bot-policy` (`BOT_ID_ENDPOINTS` for the plugin,
`BOT_ID_ROUTES` for `initBotId`). Detected bots or inconclusive verdicts return
403, verification errors 500 (`UNKNOWN_ERROR`). App-owned non-auth API routes
use `rejectBotRequest()` (403 bot / 503 unavailable). Production requires
Vercel's request/OIDC context; there is no missing-key bypass. OAuth token exchange
and native desktop requests do not require browser BotID instrumentation.

Better Auth 1.7.3+ no longer writes `account.issuer`. Apply
`apps/calendar/drizzle/0022_relax_legacy_account_issuer.sql` before deploying
the 1.7.7 packages in either app. The legacy column stays nullable; account
identity is enforced by the existing `(providerId, accountId)` unique index.

Meet has no sign-in surface of its own: it reads the session the calendar
established and links there to authenticate. That requires `AUTH_COOKIE_DOMAIN`
set identically in both apps (both must be subdomains of it) and a
byte-identical `BETTER_AUTH_SECRET`. See `packages/auth/src/cross-app.ts`.

## AI assistant (command palette)

Cmd/Ctrl+K opens an AI command palette (`packages/calendar/components/ai/ai-command-palette.tsx`,
shadcn cmdk `Command` in `@zntr/ui/command`). Its backend is
`POST /api/agent/chat`: Groq `openai/gpt-oss-120b` via the AI SDK (override
with `GROQ_MODEL`), multi-step tool loop capped
at 12 tool-capable steps plus a final tool-free summary, per-user rate limit
20/5min. Requires `GROQ_API_KEY` (503 without). Requests propagate cancellation
to the provider, have a 270s total deadline, and discard unfinished tool calls
when continuing an interrupted conversation. The palette retains its transcript
until New conversation is selected; closing stops the current response.
The response-only `suggest_followups` tool supplies three contextual prompts
under an assistant reply; clicking one sends a new user message. It performs
no calendar actions and is hidden from the execution-marker list.

Semantic search is separate: `POST /api/agent/search` makes one `generateObject`
call to compile conditions (`packages/agent/src/search.ts`, `maxRetries: 0`).
`search-match.ts` scans all candidate pages locally across title, description,
location, category and participants. Concept groups are ANDed, alternatives are
ORed; scores order matches, never truncate them. If a full scan finds zero matches
but candidates exist, one additional call supplies alternative expressions for
the same subjects. `extendSearchQuery` preserves original terms and all hard
constraints, then re-scans the already loaded candidates. No time window is
invented for an unbounded search. At most two model calls, no per-event/batch AI.
An encrypted search token freezes ordering for pagination (zero model calls).
Provider 429 remains 429. Tests in `tests/calendar/api/agent-search.test.ts` mock
only compilation; `tests/agent/search.live.test.ts` is an opt-in real compiler
evaluation. Mock passes do not establish real-model search quality.

Tools are authored ONCE in `packages/agent/src/tools.ts` — plain AI SDK
`tool()`, with a local `defineTool` helper that adds the error boundary
(a thrown tool error is returned as `{ error }` so the model can recover)
and `needsApproval: true` on the two destructive tools — against the
`CalendarToolkit` port (`src/types.ts`). The app binds it with its database
toolkit (`apps/calendar/features/agent/toolkit.ts`, built from the SAME
`features/mcp/*-tools.ts` functions the MCP server uses, so the palette and an
external MCP client share cache invalidation and reminder reconciliation).

There are still two event write paths — this one and the REST handler in
`app/api/events/route.ts` — and they stay separate: the REST path owns request
validation, category ownership and invite merging, which the MCP path has no
need for. What they must NOT do is each carry a private copy of the parts that
have to agree. Those live in `apps/calendar/features/events/write.ts`
(`encryptMergedFields`, `isValidRrule`, `isValidStamp`, `shiftOverrideStamps`,
`remapSeriesOverrideStamps`) and both sides import them.

That module exists because the copies had already drifted: the route's
`encryptMergedFields` handled `participants` and `emailReminder` and the MCP one
did not, so `updateEvent` through the agent silently dropped participant
changes while the web UI applied them. Nothing caught it — the merge is a plain
`Record<string, unknown>` spread into a drizzle `.set()`, so a forgotten field
is a silently dropped write, not a type error. Add a field there, never at a
call site. Tests: `tests/agent/` (node env).

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

In `packages/calendar/components/event/event-editor.tsx`: `applyParsedEvent` merges the
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

- `next.config.ts` sets `typescript.ignoreBuildErrors: true` — always run `bun run type-check` separately.
- `tailwind.config.ts` is empty — Tailwind v4 uses `@tailwindcss/postcss` with CSS-based config.
- Formatting options and ignore patterns live in the root `bunfig.toml` `[fmt]` section.
- `tsconfig.json` at root extends to apps; `apps/calendar/tsconfig.json` adds path aliases (`@/*`, `@zntr/*`).
- `tests/calendar/tsconfig.json` and `tests/meet/tsconfig.json` inherit app aliases so Bun resolves test mocks and source imports to the same files. Bun hoists dependencies to the root.
- Component UI library (`@zntr/ui`) uses single-file components at `packages/ui/src/*.tsx` with barrel `index.ts`.
- `calendar-client` is a Tauri desktop app: `build` checks and bundles its frontend,
  while `build:tauri` runs the native Tauri bundler. The manual Workspace Checks
  workflow can build the four desktop targets with `desktop_environment` set to
  `dev` or `production`; the dev configuration has a separate application ID.
- knip config in root `package.json` tracks known dead-code exceptions.
- Vercel crons run via `apps/calendar/vercel.json`: `GET /api/blob/check` at midnight UTC (which runs every job in `apps/calendar/lib/maintenance/jobs.ts` — table health, MCP audit retention, expired OAuth state, expired meetings) and `GET /api/reminders/topup` at 2am UTC. `/api/blob/check?jobs=<name>[,<name>]` runs a subset by hand. apps/meet registers no crons: it sweeps expired meetings from the calendar's maintenance run, since the rows are in the same database.
- Recurrence expansion has exactly ONE owner: `packages/calendar/lib/recurrence/engine.ts`. Server consumers import the package directly. Meet's dashboard reads upcoming meetings from `GET /api/meetings/upcoming` on the calendar rather than re-deriving occurrences, because a series master's `start_date` is its anchor, not an occurrence.
- `apps/meet` needs the calendar's `SALT` to read encrypted event titles. Its `readEventTitle` is a deliberate read-only copy of the calendar's format; if `lib/field-crypto.ts` ever changes, update it in lockstep.
- Node-postgres, not postgres-js. `Pool` + `attachDatabasePool(pool)` for Fluid
  compute, and `db.execute(sql)` returns a pg `QueryResult` — read `.rows`, it is
  not the array postgres-js returned. `stripSslParams()` in each app's drizzle
  client removes `sslmode`/`sslcert`/`sslkey`/`sslrootcert` from the URL because
  any of them silently overwrites the `ssl` object built by `resolveDbSsl()`.
- Session reads are uncached. `getServerSession()` calls `auth.api.getSession`
  directly; there is no event or session cache, and no `invalidate*Cache` call
  survives anywhere in the tree. Do not reintroduce a cache without measuring
  it against the round trip it replaces.
