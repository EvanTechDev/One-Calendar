import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from '@zntr/auth'

export function getCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    "script-src 'self' 'nonce-" +
      nonce +
      "' https://challenges.cloudflare.com" +
      (isDev ? " 'unsafe-eval'" : ''),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "media-src 'self' https://cdn.xyehr.cn",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "frame-src 'self' https://challenges.cloudflare.com https://accounts.google.com https://appleid.apple.com https://github.com https://login.microsoftonline.com",
    "form-action 'self'",
  ].join('; ')
}

/**
 * API routes and static assets get no CSP: they return no HTML, and attaching
 * a per-request nonce to a cacheable asset response is meaningless.
 */
export function isCspExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/static/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/icons/')
  )
}

export default function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)

  const { pathname } = request.nextUrl

  const isLoggedIn = !!sessionCookie

  if (isLoggedIn && pathname === '/') {
    return NextResponse.redirect(new URL('/app', request.url))
  }

  if (!isLoggedIn && pathname === '/landing') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!isLoggedIn && pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/sign-up', request.url))
  }

  if (isCspExemptPath(pathname)) {
    return NextResponse.next()
  }

  const nonce = crypto.randomBytes(16).toString('base64')
  const csp = getCsp(nonce)

  // Next derives the nonce it stamps on its own <script> tags by parsing the
  // REQUEST's content-security-policy header (see app-render's
  // parseRequestHeaders → getScriptNonceFromHeader). `x-nonce` alone is not
  // read by Next; it is kept only for next-themes in app/layout.tsx.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    /*
     * Every path except Next internals, static assets and API routes — so the
     * CSP covers pages like /invite/[token], /privacy and /terms, which the
     * previous explicit path list silently left unprotected.
     */
    '/((?!api/|_next/static/|_next/image/|favicon.ico|icons/|manifest.webmanifest|sw.js|icon.svg|logo-light.svg|logo-dark.svg|user.png).*)',
  ],
}
