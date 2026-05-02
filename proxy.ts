import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default function proxy(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
