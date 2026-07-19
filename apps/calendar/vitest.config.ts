import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest-setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@zntr/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@zntr/utils': path.resolve(__dirname, '../../packages/utils/src'),
      '@zntr/i18n': path.resolve(__dirname, '../../packages/i18n/src'),
    },
  },
})
