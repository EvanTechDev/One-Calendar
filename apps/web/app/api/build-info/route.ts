import { NextResponse } from 'next/server'

export const revalidate = 0

export async function GET() {
  return NextResponse.json(
    {
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown',
      commit: process.env.NEXT_PUBLIC_GIT_COMMIT ?? 'unknown',
      deployedAt: process.env.NEXT_PUBLIC_BUILD_TIME ?? '',
    },
    {
      headers: {
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    },
  )
}
