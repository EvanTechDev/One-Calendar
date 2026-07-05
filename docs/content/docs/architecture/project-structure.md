---
title: Project Structure
weight: 1
---

One Calendar is organized as an Nx monorepo.

```
One-Calendar/
├── apps/
│   └── calendar/          # Main calendar application
│       ├── app/           # Next.js App Router pages
│       │   ├── (app)/     # Authenticated app routes
│       │   ├── (auth)/    # Authentication pages
│       │   ├── (landing)/ # Landing page
│       │   └── api/       # API routes
│       ├── components/    # React components
│       │   ├── app/       # Calendar-specific components
│       │   │   ├── analytics/
│       │   │   ├── event/
│       │   │   ├── profile/
│       │   │   ├── sidebar/
│       │   │   └── views/
│       │   ├── auth/      # Authentication components
│       │   ├── icons/     # Custom icons
│       │   ├── landing/   # Landing page components
│       │   └── providers/ # Context providers
│       ├── hooks/         # Custom React hooks
│       ├── lib/           # Core libraries
│       │   ├── auth/      # Authentication logic
│       │   └── drizzle/   # Database schema & client
│       └── content/       # Changelog MDX content
├── packages/
│   ├── ui/                # Shared UI components (shadcn/ui)
│   ├── utils/             # Shared utilities
│   └── i18n/              # Internationalization
└── tools/                 # Build and tooling configs
```

## Key Files

| File                                  | Purpose                    |
| ------------------------------------- | -------------------------- |
| `apps/calendar/next.config.ts`        | Next.js configuration      |
| `apps/calendar/source.config.ts`      | Fumadocs MDX configuration |
| `apps/calendar/drizzle.config.ts`     | Drizzle ORM config         |
| `apps/calendar/lib/auth.ts`           | Better Auth server setup   |
| `apps/calendar/lib/drizzle/schema.ts` | Database schema            |
| `apps/calendar/project.json`          | Nx project configuration   |
