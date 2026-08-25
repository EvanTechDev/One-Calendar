import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest-setup.ts'],
    include: ['../../tests/meet/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@zntr/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@zntr/utils': path.resolve(__dirname, '../../packages/utils/src'),
      '@zntr/meetings': path.resolve(__dirname, '../../packages/meetings/src'),
      // Tests live outside this app, and pnpm does not hoist to the repo root,
      // so a bare import from tests/meet cannot find the app's own dependency.
      'livekit-server-sdk': path.resolve(
        __dirname,
        'node_modules/livekit-server-sdk',
      ),
      // Same reason, and it also makes `vi.mock` work: without the alias the
      // test file's specifier stays unresolved while the component under test
      // resolves the real module, so the mock silently never applies.
      '@livekit/components-react': path.resolve(
        __dirname,
        'node_modules/@livekit/components-react',
      ),
      'livekit-client': path.resolve(__dirname, 'node_modules/livekit-client'),
    },
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
})
