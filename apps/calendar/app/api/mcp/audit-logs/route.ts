import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/api-helpers'
import { getAuditLogs, getAuditLogsCount } from '@/lib/mcp/audit'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const page = Number(searchParams.get('page') ?? 1)
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100)

  const [logs, total] = await Promise.all([
    getAuditLogs(user.id, limit, (page - 1) * limit),
    getAuditLogsCount(user.id),
  ])

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
