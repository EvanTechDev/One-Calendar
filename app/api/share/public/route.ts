import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(_request: NextRequest) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
