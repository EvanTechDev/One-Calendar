/**


 * Participant email validation.
 *
 * This rule lived as a literal in five places and, worse, as two functions
 * named `normalizeEmails` in this same directory that disagreed about
 * duplicates and about a cap — so the MCP `create_event` tool silently
 * collapsed a duplicate while `add_event_participants` rejected it. One
 * implementation, one regex, and each caller keeps its own error class.
 */

/**
 * Deliberately loose: enough to catch typos and obvious garbage, not a
 * deliverability check. The shared shape across every previous copy.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Trimmed, lower-cased — the canonical form a participant is stored under. */
export function canonicalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isEmail(value: string): boolean {
  return EMAIL_REGEX.test(canonicalizeEmail(value))
}

export interface NormalizeEmailsOptions {
  /** Reject a longer list rather than accepting it. Unbounded when omitted. */
  max?: number
  /**
   * Reject duplicates instead of collapsing them. Callers differ on purpose:
   * replacing an event's participant list is idempotent, while adding to an
   * existing one is not.
   */
  rejectDuplicates?: boolean
  /** Builds the error for any rejected input — the caller owns its own class. */
  invalid: (message: string) => Error
}

/**
 * Canonicalises a participant list, rejecting what the caller rejects.
 *
 * An empty list is valid here: clearing an event's participants is a real
 * operation. Callers that forbid it check for that themselves.
 */
export function normalizeEmails(
  emails: string[],
  options: NormalizeEmailsOptions,
): string[] {
  const { max, rejectDuplicates, invalid } = options

  if (max !== undefined && emails.length > max) {
    throw invalid(`Maximum ${max} participants allowed`)
  }

  const unique = [...new Set(emails.map(canonicalizeEmail))]
  if (rejectDuplicates && unique.length !== emails.length) {
    throw invalid('Duplicate emails not allowed')
  }

  for (const email of unique) {
    if (!EMAIL_REGEX.test(email)) {
      throw invalid(`Invalid email: ${email}`)
    }
  }

  return unique
}
