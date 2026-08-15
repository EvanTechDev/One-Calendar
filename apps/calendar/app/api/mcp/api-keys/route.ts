import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/api-helpers'
import {
  generateApiKey,
  listApiKeys,
  deleteApiKey,
  updateApiKeyScopes,
} from '@/lib/mcp/auth'

export const runtime = 'nodejs'

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
  const { name, scopes } = body as { name?: string; scopes?: string[] }

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const key = await generateApiKey(name, user.id, scopes ?? [])

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
  const { id, scopes } = body as { id?: string; scopes?: string[] }

  if (!id) {
    return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
  }

  if (scopes) {
    await updateApiKeyScopes(id, user.id, scopes)
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
