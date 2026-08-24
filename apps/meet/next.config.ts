import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Room connection is managed imperatively; double-invoked effects under
  // strict mode cause connect/disconnect churn.
  reactStrictMode: false,
  transpilePackages: [
    '@zntr/ui',
    '@zntr/utils',
    '@zntr/auth',
    '@zntr/meetings',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // The room UI carries mic/camera/screen-share controls; framing it
          // elsewhere would let a hostile page trick users into clicking them.
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Required for E2EE: SharedArrayBuffer / crypto workers need
          // cross-origin isolation.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ]
  },
}

export default nextConfig
