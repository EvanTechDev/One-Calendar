import { and, eq, inArray, isNull } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import {
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
} from '@zntr/auth/schema'
import { getAuthedUser } from '@/lib/api-helpers'
import { getDb } from '@/lib/drizzle/client'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getAuthedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const consents = await db
    .select()
    .from(oauthConsent)
    .where(eq(oauthConsent.userId, user.id))
    .orderBy(oauthConsent.createdAt)
  const clientIds = [...new Set(consents.map((consent) => consent.clientId))]
  const clients = clientIds.length
    ? await db
        .select({
          clientId: oauthClient.clientId,
          name: oauthClient.name,
          disabled: oauthClient.disabled,
        })
        .from(oauthClient)
        .where(inArray(oauthClient.clientId, clientIds))
    : []
  const clientsById = new Map(
    clients.map((client) => [client.clientId, client]),
  )

  return NextResponse.json({
    apps: consents
      .map((consent) => {
        const client = clientsById.get(consent.clientId)
        if (!client || client.disabled) return null
        return {
          id: consent.id,
          clientId: consent.clientId,
          clientName: client.name ?? 'OAuth client',
          scopes: consent.scopes,
          resources: consent.resources ?? [],
          createdAt: consent.createdAt,
        }
      })
      .filter((app) => app !== null),
  })
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    id?: unknown
  } | null
  if (typeof body?.id !== 'string' || !body.id) {
    return NextResponse.json(
      { error: 'Consent ID is required' },
      { status: 400 },
    )
  }

  const db = getDb()
  const [consent] = await db
    .select({ id: oauthConsent.id, clientId: oauthConsent.clientId })
    .from(oauthConsent)
    .where(and(eq(oauthConsent.id, body.id), eq(oauthConsent.userId, user.id)))
  if (!consent) {
    return NextResponse.json(
      { error: 'Authorization not found' },
      { status: 404 },
    )
  }

  const revokedAt = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(oauthRefreshToken)
      .set({ revoked: revokedAt })
      .where(
        and(
          eq(oauthRefreshToken.userId, user.id),
          eq(oauthRefreshToken.clientId, consent.clientId),
          isNull(oauthRefreshToken.revoked),
        ),
      )
    await tx
      .update(oauthAccessToken)
      .set({ revoked: revokedAt })
      .where(
        and(
          eq(oauthAccessToken.userId, user.id),
          eq(oauthAccessToken.clientId, consent.clientId),
          isNull(oauthAccessToken.revoked),
        ),
      )
    await tx
      .delete(oauthConsent)
      .where(
        and(eq(oauthConsent.id, consent.id), eq(oauthConsent.userId, user.id)),
      )
  })

  return NextResponse.json({ success: true })
}
