import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/api-helpers'
import {
  generateApiKey,
  listApiKeys,
  deleteApiKey,
  updateApiKeyScopes,
} from '@/lib/mcp/auth'
import { parseScopes } from '@/lib/mcp/scopes'
import { checkFixedWindowLimit, rateLimitedResponse } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * Minting a key costs a cost-10 bcrypt hash, and every stored key widens the
 * `verifyApiKey` scan — so an authenticated user could otherwise insert rows
 * without bound. The DB is the real limit; this just keeps it cheap.
 */
const KEY_MINT_LIMIT = { name: 'mcp-api-key', limit: 20, windowSeconds: 3600 }

export async function GET() {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await listApiKeys(user.id)
  return NextResponse.json({ keys })
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { name, scopes } = body as { name?: string; scopes?: unknown }

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const parsedScopes = parseScopes(scopes)
  if (!parsedScopes) {
    return NextResponse.json({ error: 'Invalid scopes' }, { status: 400 })
  }

  const limited = await checkFixedWindowLimit({
    ...KEY_MINT_LIMIT,
    subject: user.id,
  })
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfter)

  const key = await generateApiKey(name, user.id, parsedScopes)

  return NextResponse.json({
    key,
    message: 'Save this key now — it will not be shown again',
  })
}

export async function PUT(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { id, scopes } = body as { id?: string; scopes?: unknown }

  if (!id) {
    return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
  }

  if (scopes !== undefined) {
    const parsedScopes = parseScopes(scopes)
    if (!parsedScopes) {
      return NextResponse.json({ error: 'Invalid scopes' }, { status: 400 })
    }
    await updateApiKeyScopes(id, user.id, parsedScopes)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { id } = body as { id?: string }

  if (!id) {
    return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
  }

  const deleted = await deleteApiKey(id, user.id)
  if (!deleted) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
