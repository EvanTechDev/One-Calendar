import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['../../tests/agent/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@zntr/agent': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
})
