import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = async function POST() {
  return NextResponse.json(
    {
      error:
        'Auto-backup is deprecated. Data is now stored directly on the server.',
    },
    { status: 410 },
  )
}

export const GET = async function GET() {
  return NextResponse.json(
    {
      error:
        'Auto-backup is deprecated. Data is now stored directly on the server.',
    },
    { status: 410 },
  )
}

export const DELETE = async function DELETE() {
  return NextResponse.json(
    {
      error:
        'Auto-backup is deprecated. Data is now stored directly on the server.',
    },
    { status: 410 },
  )
}
