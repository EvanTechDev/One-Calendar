---
title: Database Setup
weight: 3
---

One Calendar uses **Drizzle ORM** with **PostgreSQL** for data persistence.

## Schema

The database schema is defined in `apps/calendar/lib/drizzle/schema.ts` and includes:

- **User** - User accounts
- **Session** - Authentication sessions
- **Account** - OAuth and email/password accounts
- **Verification** - Email verification tokens
- **TwoFactor** - Two-factor authentication
- **Shares** - Encrypted shared calendar data
- **CalendarBackup** - Encrypted calendar backups

## Setup

After configuring `POSTGRES_URL` in your `.env`:

```bash
# Push schema directly to database (development)
pnpm dlx drizzle-kit push

# Generate and apply migrations (production)
pnpm dlx drizzle-kit generate
pnpm dlx drizzle-kit migrate
```

## Local-first Design

One Calendar uses a local-first architecture:

- Calendar events and categories are stored in **encrypted local storage** by default
- The database is optional and only used for **cloud sync**, **backup**, and **sharing**
- Users can use the app fully offline without a database
