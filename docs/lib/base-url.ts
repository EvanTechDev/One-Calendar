export function getBaseUrl(): URL {
  const explicit = process.env.BASE_URL
  if (explicit) {
    try {
      return new URL(explicit)
    } catch {
      // Fall through to Vercel fallbacks below. Vercel project settings can
      // contain unresolved references like "$NEXT_PUBLIC_VERCEL_URL" that
      // arrive here as literal strings.
    }
  }

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  if (vercelHost) {
    return new URL(`https://${vercelHost}`)
  }

  if (process.env.NODE_ENV !== 'production') {
    return new URL('http://localhost:3002')
  }
  throw new Error('Set BASE_URL to the public URL of Zentra Docs')
}
