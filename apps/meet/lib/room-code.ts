/**
 * The `xxxx-xxxx` room code shape (ADR 0019) and how raw user input maps onto
 * it.
 *
 * Lives in lib rather than beside a component because three call sites need
 * the same answer: the join form, the root-level `/[code]` route guard, and
 * the New meeting dialog. The pattern is load-bearing — codes always contain a
 * hyphen, which is what stops a code shadowing a reserved path like
 * `/dashboard` — so a second, drifting copy of it is a routing bug waiting to
 * happen.
 */

export const ROOM_CODE_PATTERN = /^[a-z0-9]{4}-[a-z0-9]{4}$/

export function isRoomCode(value: string): boolean {
  return ROOM_CODE_PATTERN.test(value)
}

/**
 * Extracts a room code from raw input — a bare code, a root-path link
 * (`/ab3k-x9q2`), or a legacy `/rooms/<code>` link.
 */
export function parseRoomInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    const legacy = url.pathname.match(/\/rooms\/([^/]+)/)
    const candidate = legacy
      ? legacy[1]
      : url.pathname.replace(/^\/+|\/+$/g, '')
    return isRoomCode(candidate) ? candidate : null
  } catch {
    return isRoomCode(trimmed) ? trimmed : null
  }
}

/**
 * The search and hash of a pasted invite link must survive the jump into
 * the room: the hash carries the E2EE passphrase, and dropping it lands the
 * user in an encrypted room without the key.
 */
export function invitePartsFrom(value: string): {
  search: string
  hash: string
} {
  try {
    const url = new URL(value.trim())
    return { search: url.search, hash: url.hash }
  } catch {
    return { search: '', hash: '' }
  }
}
