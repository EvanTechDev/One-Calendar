import { NextRequest, NextResponse } from 'next/server'
import { requireBearer } from '@/lib/authz'

export async function GET(req: NextRequest) {
  try {
    const user = await requireBearer(req)
    return NextResponse.json({ did: user.did, client_id: user.clientId, scope: user.scope })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 })
  }
}
