import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { mcpDeviceCodes } from '@/lib/drizzle/schema'
import { eq, and, gte } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const userCode = body.user_code || body.code
    const userId = body.user_id

    if (!userCode || !userId) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'Missing user_code or user_id',
        },
        { status: 400 },
      )
    }

    const db = await getDb()

    const [record] = await db
      .select()
      .from(mcpDeviceCodes)
      .where(
        and(
          eq(mcpDeviceCodes.userCode, userCode),
          eq(mcpDeviceCodes.status, 'pending'),
          gte(mcpDeviceCodes.expiresAt, new Date()),
        ),
      )

    if (!record) {
      return NextResponse.json(
        {
          error: 'invalid_grant',
          error_description: 'Invalid or expired code',
        },
        { status: 400 },
      )
    }

    await db
      .update(mcpDeviceCodes)
      .set({ status: 'approved', userId })
      .where(eq(mcpDeviceCodes.id, record.id))

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 },
    )
  }
}
