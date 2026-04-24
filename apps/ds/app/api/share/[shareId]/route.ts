import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await params
  return NextResponse.json({ shareId, source: 'ds-public-share-api' })
}
