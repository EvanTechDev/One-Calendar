import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/api-helpers'
import {
  getAuditLogs,
  getAuditLogsCount,
  getAuditToolNames,
  type AuditLogFilters,
} from '@/lib/mcp/audit'
import type { AuditEntryType } from '@/lib/mcp/types'

export const runtime = 'nodejs'

const ENTRY_TYPES: AuditEntryType[] = ['request', 'tool_call']

function positiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(Math.floor(parsed), max)
}

export async function GET(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const page = positiveInt(searchParams.get('page'), 1, 10_000)
  const limit = positiveInt(searchParams.get('limit'), 50, 100)

  const entryTypeParam = searchParams.get('entryType')
  const filters: AuditLogFilters = {
    entryType: ENTRY_TYPES.includes(entryTypeParam as AuditEntryType)
      ? (entryTypeParam as AuditEntryType)
      : undefined,
    mutationsOnly: searchParams.get('mutationsOnly') === 'true',
    failuresOnly: searchParams.get('failuresOnly') === 'true',
    toolName: searchParams.get('toolName') || undefined,
  }

  const [logs, total, toolNames] = await Promise.all([
    getAuditLogs(user.id, limit, (page - 1) * limit, filters),
    getAuditLogsCount(user.id, filters),
    getAuditToolNames(user.id),
  ])

  return NextResponse.json({
    logs,
    // Lets the client build the tool filter from what actually happened rather
    // than hardcoding the tool list.
    toolNames,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  })
}
