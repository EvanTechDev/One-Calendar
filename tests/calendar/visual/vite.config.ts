import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/postcss'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const here = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: here,
  publicDir: `${root}/apps/calendar/public`,
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: 'next/dynamic', replacement: `${here}/next-dynamic.tsx` },
      { find: '@', replacement: `${root}/apps/calendar` },
    ],
    dedupe: ['react', 'react-dom'],
  },
  define: {
    'process.env.NEXT_PUBLIC_AI_ENABLED': JSON.stringify(''),
    'process.env.NEXT_PUBLIC_APP_URL': JSON.stringify('http://127.0.0.1:4173'),
    'process.env.NEXT_PUBLIC_BASE_URL': JSON.stringify('http://127.0.0.1:4173'),
    'process.env.NEXT_PUBLIC_APP_VERSION': JSON.stringify('visual-baseline'),
    'process.env.NEXT_PUBLIC_GIT_COMMIT': JSON.stringify('baseline'),
    'process.env.NEXT_PUBLIC_BUILD_TIME': JSON.stringify('2026-10-05T00:00:00Z'),
    'process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY': JSON.stringify(''),
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
})
