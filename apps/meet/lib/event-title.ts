import crypto from 'node:crypto'

/**
 * Read-only decryption of a calendar event's encrypted title.
 *
 * The calendar app encrypts sensitive event fields at the application layer
 * (`apps/calendar/lib/field-crypto.ts`), keyed by HKDF over `SALT` and the
 * row id. The meet dashboard displays event titles, so it needs the read half
 * of that scheme. Deliberately read-only: meet never writes event fields, and
 * duplicating only the reader keeps the calendar as the single owner of the
 * format.
 *
 * If the format there ever changes, this must be updated in lockstep.
 */

const ALGORITHM = 'aes-256-gcm'
const CURRENT_VERSION = 1

interface Envelope {
  v?: number
  ct: string
  iv: string
  tag: string
}

function deriveKey(salt: string, rowId: string): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(salt, 'utf8'),
      Buffer.from(rowId, 'utf8'),
      'field-encryption',
      32,
    ),
  )
}

function looksLikeEnvelope(value: string): boolean {
  if (!value.startsWith('{')) return false
  try {
    const parsed = JSON.parse(value) as Partial<Envelope>
    return (
      typeof parsed.ct === 'string' &&
      typeof parsed.iv === 'string' &&
      typeof parsed.tag === 'string'
    )
  } catch {
    return false
  }
}

/**
 * A misconfigured SALT degrades every calendar-linked meeting to "Untitled
 * meeting", which looks like a data problem rather than a missing env var.
 * Warned once per process — per-title would be one line per dashboard row.
 */
let warnedAboutSalt = false
function warnMissingSaltOnce(): void {
  if (warnedAboutSalt) return
  warnedAboutSalt = true
  console.warn(
    '[event-title] SALT is unset or shorter than 16 characters, so encrypted ' +
      'event titles cannot be read and every calendar-linked meeting will ' +
      'show "Untitled meeting". It must match the calendar app\'s SALT exactly.',
  )
}

/**
 * Returns the plaintext title, the value unchanged when it is legacy
 * plaintext, or a neutral placeholder when it cannot be read — never raw
 * ciphertext, which would be worse than saying nothing.
 */
export function readEventTitle(rowId: string, stored: string): string {
  if (!looksLikeEnvelope(stored)) return stored

  const salt = process.env.SALT
  if (!salt || salt.length < 16) {
    warnMissingSaltOnce()
    return 'Untitled meeting'
  }

  try {
    const parsed = JSON.parse(stored) as Envelope
    if ((parsed.v ?? 1) !== CURRENT_VERSION) return 'Untitled meeting'
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      deriveKey(salt, rowId),
      Buffer.from(parsed.iv, 'hex'),
    )
    decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'))
    let plaintext = decipher.update(parsed.ct, 'hex', 'utf8')
    plaintext += decipher.final('utf8')
    return plaintext
  } catch {
    return 'Untitled meeting'
  }
}
