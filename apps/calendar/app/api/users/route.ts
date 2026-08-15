import { type NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { user } from '@/lib/drizzle/schema'
import { inArray } from 'drizzle-orm'
import { getAuthedUser } from '@/lib/api-helpers'

export const runtime = 'nodejs'

export const GET = async function GET(request: NextRequest) {
  const currentUser = await getAuthedUser()
  if (!currentUser)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const emailsParam = searchParams.get('emails')
  if (!emailsParam) {
    return NextResponse.json({ users: [] })
  }

  const emails = emailsParam
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (emails.length === 0) {
    return NextResponse.json({ users: [] })
  }

  const users = await getDb()
    .select({
      email: user.email,
      name: user.name,
      image: user.image,
    })
    .from(user)
    .where(inArray(user.email, emails))

  const userMap = users.reduce(
    (acc, u) => {
      acc[u.email] = { name: u.name, image: u.image }
      return acc
    },
    {} as Record<string, { name: string; image: string | null }>,
  )

  return NextResponse.json({ users: userMap })
}
