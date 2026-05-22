import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

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

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/landing', '/app/:path*', '/sign-in', '/sign-up'],
}
