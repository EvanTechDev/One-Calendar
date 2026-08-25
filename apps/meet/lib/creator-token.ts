'use client'

/**
 * Client-side store for guest Organisers' Creator Tokens (ADR 0016).
 *
 * A guest who creates a Meeting receives an unguessable token once; holding
 * it is the sole credential for their Organiser authority (End Meeting,
 * reopen). Clearing storage or switching browsers loses that authority —
 * the accepted cost of accountless ownership.
 */

const STORAGE_KEY = 'zentra-meet-creator-tokens'

type TokenMap = Record<string, string>

function readAll(): TokenMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function storeCreatorToken(meetingId: string, token: string): void {
  if (typeof window === 'undefined') return
  try {
    const all = readAll()
    all[meetingId] = token
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // Storage unavailable (private browsing) — the guest simply loses
    // Organiser powers on reload.
  }
}

export function getCreatorToken(meetingId: string): string | undefined {
  return readAll()[meetingId]
}
