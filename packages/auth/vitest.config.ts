import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['../../tests/auth/**/*.test.ts'],
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
    },
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
})
