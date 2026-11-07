<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../../packages/shared/calendar/assets/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="../../packages/shared/calendar/assets/logo-light.svg">
    <img src="../../packages/shared/calendar/assets/logo-light.svg" alt="Zentra Calendar logo" width="112" height="112">
  </picture>

  <h1>Zentra Calendar</h1>
  <p>Open-source scheduling with an AI agent, thoughtful collaboration, and no lock-in.</p>

  <p>
    <a href="https://calendar.xyehr.cn">Live product</a> ·
    <a href="https://calendarstatus.xyehr.cn">Status</a> ·
    <a href="../../docs">Documentation source</a> ·
    <a href="https://bsky.app/profile/calendar.xyehr.cn">Bluesky</a>
  </p>
</div>

## Why Zentra Calendar?

Zentra Calendar combines a fast, keyboard-friendly calendar with an agent that can understand scheduling requests and act through scoped tools. You keep a clear view of your data, your events remain portable, and the entire stack can run on your own infrastructure.

## Features

| Area                    | Included                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **AI & automation**     | Natural-language quick create, conversational scheduling, semantic search, and a scoped MCP server for compatible clients |
| **Planning**            | Drag-and-drop scheduling, inline editing, keyboard navigation, and day/week/month/year views                              |
| **Events**              | RRULE recurrence with per-occurrence edit scopes, invitations, RSVP links, categories, bookmarks, and countdowns          |
| **Reminders**           | In-app notifications and optional per-event email delivery through Resend                                                 |
| **Portability**         | ICS import/export and cloud sync backed by PostgreSQL and Drizzle                                                         |
| **Identity & security** | Better Auth sessions, two-factor authentication, scoped credentials, and browser bot protection                           |
| **Personalization**     | Light/dark/system themes, 34 languages, and a composable shadcn/ui interface                                              |
| **Ownership**           | Open-source, self-hostable application code with portable data                                                            |

## Quick start

### Prerequisites

- [Bun 1.4.4](https://bun.sh)
- [Node.js 25](https://nodejs.org)
- PostgreSQL

### 1. Install and configure

Run from the repository root:

```bash
git clone https://github.com/EvanTechDev/One-Calendar.git
cd One-Calendar
bun install
cp apps/calendar/.env.example apps/calendar/.env
```

Fill in at least these values in `apps/calendar/.env`:

| Variable                         | Purpose                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_BASE_URL`           | Public Calendar origin used by the server and brand links                                |
| `NEXT_PUBLIC_APP_URL`            | Browser auth and OAuth origin; use the same origin as above                              |
| `BETTER_AUTH_URL`                | Origin used in authentication and invitation links                                       |
| `BETTER_AUTH_SECRET`             | Secret used to sign sessions                                                             |
| `SALT`                           | Stable key material for encrypted event fields; back it up and do not rotate it casually |
| `POSTGRES_URL` or `DATABASE_URL` | PostgreSQL connection string                                                             |

The example file also documents email delivery, AI, cross-app cookies, cron protection, and other optional services.

### 2. Prepare the database

From `apps/calendar`:

```bash
bun x --no-install drizzle-kit push
```

For production, apply the checked-in migrations instead:

```bash
bun x --no-install drizzle-kit migrate
```

> **Important:** Do not use `drizzle-kit generate` in this repository. Its snapshots do not cover all existing migrations, so generation can prompt for incorrect table renames. Hand-write SQL in `apps/calendar/drizzle/` following the existing migration style, then mirror the change in `lib/drizzle/schema.ts`.

### 3. Start developing

From the repository root:

```bash
bun run --filter zentra-calendar dev
```

Open [http://localhost:3000](http://localhost:3000). To start every app in the monorepo, use `bun run dev` instead.

## Deploy to Vercel

Connect the **full Git repository**, then configure **Settings → Build and Deployment**:

1. Set **Root Directory** to `apps/calendar`.
2. Enable **Include source files outside of the Root Directory in the Build Step**.
3. Keep the install command from [`vercel.json`](./vercel.json):

   ```bash
   bun install --frozen-lockfile --cwd ../..
   ```

The installer needs the root `package.json`, `bun.lock`, and shared `packages/` workspaces. Errors about missing `@zntr/*` workspace dependencies usually mean the outside-root option is disabled or the repository was only partially included.

## Security notes

Calendar and Meet use Vercel BotID Basic on browser credential and mail-sending authentication endpoints. Browser instrumentation and server verification share the policies in `@zntr/auth`; no visible challenge is required.

Production verification requires Vercel's request/OIDC context. Detected bots receive 403, while verification failures follow the route's explicit error policy. Rate limits still apply. OAuth token exchange and native desktop IPC requests do not use browser BotID instrumentation.

For Meet to share Calendar's session, both apps must use the same `AUTH_COOKIE_DOMAIN`, be subdomains of that domain, and have byte-identical `BETTER_AUTH_SECRET` values.

## Useful commands

Run from the repository root:

| Command                                       | Purpose                                        |
| --------------------------------------------- | ---------------------------------------------- |
| `bun run --filter zentra-calendar dev`        | Start Calendar                                 |
| `bun run --filter zentra-calendar build`      | Generate locales and create a production build |
| `bun run --filter zentra-calendar type-check` | Check TypeScript                               |
| `bun run --filter zentra-calendar lint:check` | Lint without fixes                             |
| `bun run --filter zentra-calendar test`       | Run Calendar tests                             |

See the repository [engineering guide](../../AGENTS.md) for workspace conventions and verification requirements.

## Built with

![Next.js, TypeScript, React, Tailwind CSS, shadcn/ui, Zustand, Drizzle, Better Auth, and Resend](https://skills.syvixor.com/api/icons?perline=15&i=nextjs,typescript,reactjs,tailwindcss,shadcnui,zustand,drizzle,betterauth,resend)
