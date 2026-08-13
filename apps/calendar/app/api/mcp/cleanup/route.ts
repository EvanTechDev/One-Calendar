import { NextResponse } from 'next/server'
import { cleanupAuditLogs } from '@/lib/mcp/audit'
import { parseRetentionDays, secretMatches } from '@/lib/mcp/cleanup-config'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const provided = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (!cronSecret || !secretMatches(provided, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const retentionDays = parseRetentionDays(
    new URL(request.url).searchParams.get('retentionDays'),
  )

  const schedule = request.headers.get('x-vercel-cron-schedule')
  console.info('MCP audit cleanup cron invoked', { schedule, retentionDays })

  try {
    const deleted = await cleanupAuditLogs(retentionDays)
    return NextResponse.json({ deleted })
  } catch (error) {
    console.error('MCP audit cleanup failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}