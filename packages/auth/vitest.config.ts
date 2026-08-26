import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['../../tests/auth/**/*.test.ts'],
    // The integration tests (plan 026 Seam 2) reach a real Postgres in
    // eu-north-1; a TLS handshake from a phone does not fit the 5s default.
    // Kept as a per-suite budget rather than a global one so a genuinely hung
    // unit test still fails fast.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@zntr/auth': path.resolve(__dirname, 'src'),
      // Tests live outside this package and pnpm does not hoist to the repo
      // root, so a bare specifier in tests/auth resolves to nothing while the
      // source under test resolves the real module — `vi.mock` then silently
      // never applies and the test runs against Better Auth itself.
      'better-auth/adapters/drizzle': path.resolve(
        __dirname,
        'node_modules/better-auth/dist/adapters/drizzle-adapter/index.mjs',
      ),
      'better-auth/plugins': path.resolve(
        __dirname,
        'node_modules/better-auth/dist/plugins/index.mjs',
      ),
      'better-auth': path.resolve(__dirname, 'node_modules/better-auth'),
      '@better-auth/sentinel': path.resolve(
        __dirname,
        'node_modules/@better-auth/sentinel',
      ),
      // The integration tests (plan 026 Seam 2) need a real Postgres driver.
      // It is not a dependency of this package -- the calendar owns it -- and
      // pnpm does not hoist to the repo root, so tests/auth cannot resolve a
      // bare specifier without this.
      postgres: path.resolve(
        __dirname,
        '../../apps/calendar/node_modules/postgres',
      ),
    },
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
})
