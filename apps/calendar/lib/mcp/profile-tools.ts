import { getDb } from '@/lib/drizzle/client'
import { user } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'

export async function getProfile(userId: string) {
  const db = await getDb()
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, userId))

  return row ?? null
}
