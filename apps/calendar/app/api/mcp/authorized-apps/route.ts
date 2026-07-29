import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/api-helpers'
import { getDb } from '@/lib/drizzle/client'
import { mcpTokens } from '@/lib/drizzle/schema'
import { eq, and, gte } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const apps = await db
    .select({
      id: mcpTokens.id,
      clientId: mcpTokens.clientId,
      clientName: mcpTokens.clientName,
      scopes: mcpTokens.scopes,
      createdAt: mcpTokens.createdAt,
      expiresAt: mcpTokens.expiresAt,
      isRevoked: mcpTokens.isRevoked,
    })
    .from(mcpTokens)
    .where(
      and(eq(mcpTokens.userId, user.id), gte(mcpTokens.expiresAt, new Date())),
    )
    .orderBy(mcpTokens.createdAt)

  return NextResponse.json({ apps })
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { id } = body as { id?: string }

  if (!id) {
    return NextResponse.json({ error: 'Token ID is required' }, { status: 400 })
  }

  const db = await getDb()
  await db
    .update(mcpTokens)
    .set({ isRevoked: true })
    .where(and(eq(mcpTokens.id, id), eq(mcpTokens.userId, user.id)))

  return NextResponse.json({ success: true })
}
