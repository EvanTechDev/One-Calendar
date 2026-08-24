import { getServerSession } from '@/lib/auth/server'
import { decryptFieldStrict, decryptJsonField } from '@/lib/field-crypto'
import { calendarEvents } from '@/lib/drizzle/schema'

export async function getAuthedUser() {
  const session = await getServerSession()
  if (!session?.user) return null
  return session.user
}

export function decryptEvent(event: typeof calendarEvents.$inferSelect) {
  return {
    ...event,
    // decryptFieldStrict passes legacy plaintext through unchanged and throws on
    // a genuine decryption failure — the previous `?? event.title` returned the
    // raw ciphertext envelope as the user's event title.
    title: decryptFieldStrict(event.id, event.title) ?? event.title,
    description: decryptFieldStrict(event.id, event.description),
    location: decryptFieldStrict(event.id, event.location),
    participants:
      decryptJsonField<string[]>(
        event.id,
        event.participants as string | null | undefined,
      ) ?? [],
  }
}
