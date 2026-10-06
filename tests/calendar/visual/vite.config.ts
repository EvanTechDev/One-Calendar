import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/postcss'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)))
const here = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    {
      name: 'production-calendar-css',
      enforce: 'pre',
      load(id) {
        if (
          process.env.ZENTRA_VISUAL_PRODUCTION_CSS === '1' &&
          id === `${root}/apps/calendar/app/globals.css`
        )
          return ''
      },
    },
  ],
  root: here,
  publicDir: `${root}/apps/calendar/public`,
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      {
        find: /^@fontsource-variable\/(.+)$/,
        replacement: `${root}/apps/calendar-client/node_modules/@fontsource-variable/$1`,
      },
      { find: /^\.\/native$/, replacement: `${here}/desktop-native.ts` },
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
    'process.env.NEXT_PUBLIC_BUILD_TIME': JSON.stringify(
      '2026-10-05T00:00:00Z',
    ),
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
})
