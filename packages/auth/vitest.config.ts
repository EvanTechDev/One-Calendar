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
    },
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
})
