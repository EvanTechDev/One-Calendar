import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/app',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/reset-password',
  '/api/share',
  '/api/verify',
  '/at-oauth',
  '/atproto-sign-in',
  '/api/atproto/(.*)',
  '/api/ds/oauth/(.*)',
  '/oauth-client-metadata.json',
  '/api/share/public',
  '/share/(.*)',
  '/privacy',
  '/terms',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
