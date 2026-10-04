import { decryptFieldStrict, decryptJsonField } from '@/lib/field-crypto'
import type { calendarEvents } from '@/lib/drizzle/schema'

/** Data-only helper: background reconciliation does not load session/auth setup. */
export function decryptEvent(event: typeof calendarEvents.$inferSelect) {
  return {
    ...event,
    // Legacy plaintext passes through; genuine decryption failures must throw.
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
