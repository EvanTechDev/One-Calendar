import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'ATProto sharing removed' }, { status: 410 })
}
