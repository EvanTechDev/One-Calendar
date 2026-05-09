import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/drizzle/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL || process.env.DATABASE_URL!,
  },
});

