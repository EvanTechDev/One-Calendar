import { type NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/api-helpers'
import {
  applyScopedParticipantChange,
  resolveParticipantTarget,
  ParticipantScopeError,
} from '@/lib/invites/scoped-invites'
import type { ApplyTo } from '@/lib/event-service'

export const runtime = 'nodejs'

const PARTICIPANT_SCOPES: ApplyTo[] = ['single', 'following', 'all']

export const POST = async function POST(request: NextRequest) {
  const currentUser = await getAuthedUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { eventId, emails, scope, timezone } = body as {
    eventId: string
    emails: string[]
    scope?: string
    timezone?: string
  }

  if (!eventId || !emails || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json(
      { error: 'Missing eventId or emails' },
      { status: 400 },
    )
  }

  const participantScope: ApplyTo =
    scope === undefined || scope === null ? 'all' : (scope as ApplyTo)
  if (!PARTICIPANT_SCOPES.includes(participantScope)) {
    return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })
  }

  if (emails.length > 20) {
    return NextResponse.json(
      { error: 'Maximum 20 participants allowed' },
      { status: 400 },
    )
  }

  const uniqueEmails = [...new Set(emails.map((e) => e.toLowerCase().trim()))]
  if (uniqueEmails.length !== emails.length) {
    return NextResponse.json(
      { error: 'Duplicate emails not allowed' },
      { status: 400 },
    )
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  for (const email of uniqueEmails) {
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: `Invalid email: ${email}` },
        { status: 400 },
      )
    }
  }

  const target = await resolveParticipantTarget(
    eventId,
    currentUser.id,
    timezone,
  )
  if (!target) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  try {
    await applyScopedParticipantChange({
      target,
      emails: uniqueEmails,
      scope: participantScope,
      action: 'add',
    })
  } catch (error) {
    if (error instanceof ParticipantScopeError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }

  return NextResponse.json({ success: true })
}
