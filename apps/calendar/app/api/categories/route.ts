import { type NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { calendarCategories } from '@/lib/drizzle/schema'
import { eq, and, asc } from 'drizzle-orm'
import { encryptField, decryptField } from '@/lib/field-crypto'
import crypto from 'crypto'
import { getAuthedUser } from '@/lib/api-helpers'
import { categorySchema, firstZodMessage } from '@/lib/validation'

export const runtime = 'nodejs'

function decryptCategory(cat: typeof calendarCategories.$inferSelect) {
  return {
    ...cat,
    name: decryptField(cat.id, cat.name) ?? cat.name,
  }
}

export const GET = async function GET() {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results = await getDb()
    .select()
    .from(calendarCategories)
    .where(eq(calendarCategories.userId, user.id))
    .orderBy(asc(calendarCategories.sortOrder))

  return NextResponse.json({ categories: results.map(decryptCategory) })
}

export const POST = async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = categorySchema.safeParse(
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
      .select({ userId: calendarCategories.userId })
      .from(calendarCategories)
      .where(eq(calendarCategories.id, id))
    if (existing && existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const [cat] = await getDb()
    .insert(calendarCategories)
    .values({
      id,
      userId: user.id,
      name: encryptField(id, body.name) ?? '',
      color: body.color,
      sortOrder: body.sortOrder ?? 0,
    })
    .onConflictDoUpdate({
      target: calendarCategories.id,
      set: {
        name: encryptField(id, body.name) ?? '',
        color: body.color,
        sortOrder: body.sortOrder ?? 0,
      },
    })
    .returning()

  return NextResponse.json({ category: decryptCategory(cat) })
}

export const DELETE = async function DELETE(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id } = body as { id: string }
  if (!id)
    return NextResponse.json({ error: 'Missing category id' }, { status: 400 })

  await getDb()
    .delete(calendarCategories)
    .where(
      and(
        eq(calendarCategories.id, id),
        eq(calendarCategories.userId, user.id),
      ),
    )

  return NextResponse.json({ success: true })
}
