import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@tauri-apps/api': fileURLToPath(
        new URL('./node_modules/@tauri-apps/api', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['../../tests/calendar-client/**/*.test.ts'],
  },
})
