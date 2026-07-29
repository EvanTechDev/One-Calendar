import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/api-helpers'
import { getMcpSettings, updateMcpSettings } from '@/lib/mcp/settings'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getMcpSettings(user.id)
  return NextResponse.json({ settings })
}

export async function PUT(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { enabled, rate_limit_rpm } = body as {
    enabled?: boolean
    rate_limit_rpm?: number
  }

  const updated = await updateMcpSettings(user.id, {
    enabled,
    rateLimitRpm: rate_limit_rpm,
  })

  return NextResponse.json({ settings: updated })
}
