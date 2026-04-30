import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  return NextResponse.json({
    wrappedMasterKey: session.user.wrappedMasterKey,
    wrappedMasterKeyIv: session.user.wrappedMasterKeyIv,
  })
}
