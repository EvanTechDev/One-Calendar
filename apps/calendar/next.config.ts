import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'
import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

const currentDir = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(
  readFileSync(join(currentDir, 'package.json'), 'utf8'),
)

const getGitCommit = () => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ['@zntr/ui', '@zntr/utils', '@zntr/i18n'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_GIT_COMMIT: getGitCommit(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
}

export default withMDX(nextConfig)
