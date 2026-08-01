import { NextResponse } from 'next/server'
import { cleanupAuditLogs } from '@/lib/mcp/audit'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Missing CRON_SECRET' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const retentionDays = Number(
    new URL(request.url).searchParams.get('retentionDays') ?? 30,
  )

  try {
    const deleted = await cleanupAuditLogs(retentionDays)
    return NextResponse.json({ deleted })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
