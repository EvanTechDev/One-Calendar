import { getServerSession } from '@/lib/auth/server'
import { decryptField, decryptJsonField } from '@/lib/field-crypto'
import { calendarEvents } from '@/lib/drizzle/schema'

export async function getAuthedUser() {
  const session = await getServerSession()
  if (!session?.user) return null
  return session.user
}

export function decryptEvent(event: typeof calendarEvents.$inferSelect) {
  return {
    ...event,
    title: decryptField(event.id, event.title) ?? event.title,
    description: decryptField(event.id, event.description),
    location: decryptField(event.id, event.location),
    participants: decryptJsonField(
      event.id,
      event.participants as string | null | undefined,
    ),
  }
}
