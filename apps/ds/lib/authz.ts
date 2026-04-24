import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { grants } from '@/lib/schema'
import { verifyToken } from '@/lib/oauth'

export async function requireBearer(req: NextRequest) {
  const raw = req.headers.get('authorization') ?? ''
  const token = raw.startsWith('Bearer ') ? raw.slice('Bearer '.length) : ''
  if (!token) throw new Error('missing_bearer_token')

  const iss = process.env.DS_ISSUER_URL?.trim() ?? req.nextUrl.origin
  const payload = await verifyToken(token, iss)
  const did = String(payload.sub ?? '')
  const clientId = String(payload.client_id ?? '')
  if (!did || !clientId) throw new Error('invalid_claims')

  const grantId = createHash('sha256').update(`${did}:${clientId}`).digest('hex')
  const grant = await db.select().from(grants).where(eq(grants.id, grantId)).limit(1)
  if (!grant[0]) throw new Error('grant_not_found')

  return { did, clientId, scope: String(payload.scope ?? '') }
}
