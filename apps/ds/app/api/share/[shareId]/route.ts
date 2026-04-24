import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { shareId: string } },
) {
  return NextResponse.json({ shareId: params.shareId, source: 'ds-public-share-api' })
}
