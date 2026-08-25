import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['../../tests/meetings/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@zntr/meetings': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
})
