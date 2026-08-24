# Zentra Calendar

> The next gen calendar powered by AI agent.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/a076623e-3132-42e4-a947-d3e3e3c0cf53"> 
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/1910076a-4db5-411f-8c4c-08a0148629b1">

  <img src="https://github.com/user-attachments/assets/1910076a-4db5-411f-8c4c-08a0148629b1" alt="Zentra Calendar week view">
</picture>

- [Live product](https://calendar.xyehr.cn)
- [Status](https://calendarstatus.xyehr.cn)
- [Bluesky](https://bsky.app/profile/calendar.xyehr.cn)

<a href="https://vercel.com/new/clone?repository-url=https://github.com/EvanTechDev/One-Calendar&env=NEXT_PUBLIC_BASE_URL,BETTER_AUTH_SECRET,BETTER_AUTH_URL,POSTGRES_URL,SALT&project-name=zentra-calendar&repo-name=one-calendar" style="display: inline-block;"><img src="https://vercel.com/button" alt="Deploy with Vercel" style="height: 32px;"></a>

<a href="https://producthunt.com/product/one-calendar"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=955482&theme=light&t=1748791250175"></img></a>

## What Zentra Calendar is

Zentra Calendar is an open-source calendar where an AI agent does the scheduling work with you: it plans your week, moves events through natural language, and connects to your tools over MCP (Model Context Protocol). You stay in control: the calendar remains understandable, keyboard-driven, and self-hostable.

Built for individuals and small teams who want an agent that works the calendar for them, not a dashboard that watches them.

## Features

### Agent and automation

- **MCP server**: connect Claude, Cursor, or any MCP client to read and manage your calendar with scoped API keys and OAuth
- **Natural-language event handling**: create and edit events conversationally through a connected agent
- **Scheduled email reminders**: opt-in per event, delivered through Resend

### Weekly planning

- **Drag and drop scheduling**: move and resize events directly on the grid
- **Inline editing**: create and update events without leaving the view
- **Keyboard-first interactions**: navigate and edit without touching the mouse

### Event management

- **Recurring events**: full RRULE support with single, following, and all-occurrence edit scopes
- **Invitations and RSVP**: invite participants by email; they respond from a link, no account required
- **Reminders**: in-app delivery plus optional email, per event
- **ICS import and export**: move your data in and out without lock-in

### Sync and access

- **Cloud sync**: multi-device synchronization backed by Postgres and Drizzle
- **Hardened authentication**: sessions, two-factor, and bot protection via Better Auth
- **Self-hostable**: run the whole stack on your own infrastructure

### Customization

- **Themes**: light, dark, and system, with a tuned dark surface ladder
- **34 languages**: built-in internationalization
- **Composable UI**: shadcn/ui components on Tailwind CSS

## Comparison

| Feature                         | Zentra Calendar | Google Calendar | Apple Calendar | Outlook Calendar | Proton Calendar |
| ------------------------------- | :-------------: | :-------------: | :------------: | :--------------: | :-------------: |
| AI agent access (MCP)           |       ✅        |       ⚠️        |       ❌       |        ⚠️        |       ❌        |
| Event creation and editing      |       ✅        |       ✅        |       ✅       |        ✅        |       ✅        |
| Drag and drop scheduling        |       ✅        |       ✅        |       ✅       |        ✅        |       ✅        |
| Recurring events                |       ✅        |       ✅        |       ✅       |        ✅        |       ✅        |
| Invitations and RSVP            |       ✅        |       ✅        |       ✅       |        ✅        |       ✅        |
| Reminders and notifications     |       ✅        |       ✅        |       ✅       |        ✅        |       ✅        |
| Multiple views (day/week/month) |       ✅        |       ✅        |       ✅       |        ✅        |       ✅        |
| Keyboard shortcuts              |       ✅        |       ✅        |       ⚠️       |        ✅        |       ✅        |
| Cloud sync                      |       ✅        |       ✅        |       ✅       |        ✅        |       ✅        |
| ICS import and export           |       ✅        |       ✅        |       ✅       |        ✅        |       ✅        |
| Open-source                     |       ✅        |       ❌        |       ❌       |        ❌        |       ⚠️        |
| Self-hostable                   |       ✅        |       ❌        |       ❌       |        ❌        |       ❌        |

⚠️ = limited or partial support

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) v20 or later
- [pnpm](https://pnpm.io)

### Quick start

```bash
git clone https://github.com/EvanTechDev/One-Calendar.git
cd One-Calendar
pnpm install
pnpm dev
```

Then open `http://localhost:3000`.

### Environment variables

Copy `.env.example` to `.env` and fill in the values:

```env
# Core
NEXT_PUBLIC_BASE_URL=http://localhost:3000
SALT=your_backup_salt_here

# Auth
BETTER_AUTH_SECRET=your_auth_secret_here
BETTER_AUTH_URL=http://localhost:3000

# Optional
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/calendar
BETTER_AUTH_API_KEY=your_api_key_here
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key_here
TURNSTILE_SECRET_KEY=your_secret_key_here
```

### Database

The app uses Drizzle ORM. After setting `POSTGRES_URL`, push the schema:

```bash
pnpm dlx drizzle-kit push
```

For production, use migrations instead:

```bash
pnpm dlx drizzle-kit generate
pnpm dlx drizzle-kit migrate
```

## Tech stack

![Stack](https://skills.syvixor.com/api/icons?perline=15&i=nextjs,typescript,reactjs,tailwindcss,shadcnui,zustand,drizzle,betterauth,resend)
