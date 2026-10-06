import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  publicDir: '../../packages/ui/calendar/assets',
  resolve: { dedupe: ['react', 'react-dom'] },
  define: {
    'process.env.NEXT_PUBLIC_AI_ENABLED': JSON.stringify(
      process.env.NEXT_PUBLIC_AI_ENABLED ?? '1',
    ),
    'process.env.NEXT_PUBLIC_APP_VERSION': JSON.stringify(
      process.env.npm_package_version ?? '',
    ),
    'process.env.NEXT_PUBLIC_GIT_COMMIT': JSON.stringify(
      process.env.GITHUB_SHA ?? '',
    ),
    'process.env.NEXT_PUBLIC_BUILD_TIME': JSON.stringify(
      new Date().toISOString(),
    ),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
}))
