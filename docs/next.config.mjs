import { createMDX } from 'fumadocs-mdx/next'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const withMDX = createMDX()
const __dirname = dirname(fileURLToPath(import.meta.url))
// Turbopack must include shared workspace sources and hoisted dependencies.
// (Import resolution is still scoped by docs/package.json via tsconfig's
// moduleResolution: "bundler" — this doesn't allow phantom imports.)
const workspaceRoot = resolve(__dirname, '..')

/** @type {import('next').NextConfig} */
const config = {
  turbopack: {
    root: workspaceRoot,
  },
  outputFileTracingRoot: workspaceRoot,

  reactStrictMode: true,
  redirects: async () => [
    {
      source: '/',
      destination: '/docs',
      permanent: true,
    },
  ],
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
    ]
  },
}

export default withMDX(config)
