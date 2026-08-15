import { type NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { countdowns } from '@/lib/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { encryptField, decryptField } from '@/lib/field-crypto'
import crypto from 'crypto'
import { getAuthedUser } from '@/lib/api-helpers'
import { countdownSchema, firstZodMessage } from '@/lib/validation'

export const runtime = 'nodejs'

function decryptCountdown(cd: typeof countdowns.$inferSelect) {
  return {
    ...cd,
    name: decryptField(cd.id, cd.name) ?? cd.name,
    description: decryptField(cd.id, cd.description),
  }
}

export const GET = async function GET() {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results = await getDb()
    .select()
    .from(countdowns)
    .where(eq(countdowns.userId, user.id))

  return NextResponse.json({ countdowns: results.map(decryptCountdown) })
}

export const POST = async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = countdownSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstZodMessage(parsed.error) },
      { status: 400 },
    )
  }
  const body = parsed.data
  const id = body.id ?? crypto.randomUUID()

  if (body.id) {
    const [existing] = await getDb()
      .select({ userId: countdowns.userId })
      .from(countdowns)
      .where(eq(countdowns.id, id))
    if (existing && existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const [cd] = await getDb()
    .insert(countdowns)
    .values({
      id,
      userId: user.id,
      name: encryptField(id, body.name) ?? '',
      targetDate: new Date(body.targetDate),
      repeat: body.repeat ?? 'none',
      description: encryptField(id, body.description),
      color: body.color ?? null,
      icon: body.icon ?? null,
    })
    .onConflictDoUpdate({
      target: countdowns.id,
      set: {
        name: encryptField(id, body.name) ?? '',
        targetDate: new Date(body.targetDate),
        repeat: body.repeat ?? 'none',
        description: encryptField(id, body.description),
        color: body.color ?? null,
        icon: body.icon ?? null,
      },
    })
    .returning()

  return NextResponse.json({ countdown: decryptCountdown(cd) })
}

export const DELETE = async function DELETE(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id } = body as { id: string }
  if (!id)
    return NextResponse.json({ error: 'Missing countdown id' }, { status: 400 })

  await getDb()
    .delete(countdowns)
    .where(and(eq(countdowns.id, id), eq(countdowns.userId, user.id)))

  return NextResponse.json({ success: true })
}
