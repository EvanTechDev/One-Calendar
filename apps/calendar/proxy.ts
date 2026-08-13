import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from '@zntr/auth'

function getCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    "script-src 'self' 'nonce-" + nonce + "'" + (isDev ? " 'unsafe-eval'" : ''),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "media-src 'self' https://cdn.xyehr.cn",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "frame-src 'self' https://accounts.google.com https://appleid.apple.com https://github.com https://login.microsoftonline.com",
    "form-action 'self'",
  ].join('; ')
}

export default function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)

  const { pathname } = request.nextUrl

  const isLoggedIn = !!sessionCookie

  if (isLoggedIn && pathname === '/') {
    return NextResponse.redirect(new URL('/app', request.url))
  }

  if (isLoggedIn && ['/sign-in', '/sign-up'].includes(pathname)) {
    return NextResponse.redirect(new URL('/app', request.url))
  }

  if (!isLoggedIn && pathname === '/landing') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!isLoggedIn && pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/sign-up', request.url))
  }

  if (!isLoggedIn && pathname.startsWith('/oauth/authorize')) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  const isApiOrAsset =
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/static/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/icons/')

  if (isApiOrAsset) {
    return NextResponse.next()
  }

  const nonce = crypto.randomBytes(16).toString('base64')
  request.headers.set('x-nonce', nonce)
  const response = NextResponse.next({ request })
  response.headers.set('Content-Security-Policy', getCsp(nonce))
  return response
}

export const config = {
  matcher: [
    '/',
    '/landing',
    '/app/:path*',
    '/sign-in',
    '/sign-up',
    '/oauth/authorize',
  ],
}
