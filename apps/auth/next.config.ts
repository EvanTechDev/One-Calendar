import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@zntr/ui', '@zntr/utils', '@zntr/auth'],
  typescript: {
    // Consistent with the other apps: the build does not type-check, so
    // `pnpm type-check` is a separate gate.
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // The portal renders sign-in and consent. Framing either would let a
          // hostile page overlay them and harvest credentials or steal a grant,
          // so this is load-bearing rather than hygiene.
          { key: 'X-Frame-Options', value: 'DENY' },
          // A referrer must never carry an authorization code or a token to a
          // third party. `no-referrer` rather than the other apps'
          // `strict-origin-when-cross-origin`: the portal's URLs contain
          // protocol parameters, and leaking even the origin-plus-path of an
          // authorization request is more than a client needs.
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
