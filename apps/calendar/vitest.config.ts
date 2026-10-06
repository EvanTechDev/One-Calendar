import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest-setup.ts'],
    include: ['../../tests/calendar/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '#calendar': path.resolve(__dirname, '../../packages/ui/calendar/src'),
      '@zntr/calendar-host': path.resolve(
        __dirname,
        '../../packages/calendar-host/src',
      ),
      '@zntr/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@zntr/utils': path.resolve(__dirname, '../../packages/utils/src'),
      '@zntr/i18n': path.resolve(__dirname, '../../packages/i18n/src'),
      'botid/server': path.resolve(
        __dirname,
        '../../packages/auth/node_modules/botid/dist/server/index.mjs',
      ),
    },
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
})
