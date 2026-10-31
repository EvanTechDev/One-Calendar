import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  // The meetings tables live in the shared @zntr/meetings package but their
  // migrations belong here, the repo's single migration home (ADR 0017).
  // The package's readonly-calendar.ts is deliberately excluded: it only
  // describes calendar_events for joins and must never generate DDL.
  schema: ['./lib/drizzle/schema.ts', '../../packages/meetings/src/schema.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL || process.env.DATABASE_URL!,
  },
})
