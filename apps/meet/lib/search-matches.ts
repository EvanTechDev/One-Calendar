/**
 * Why a meeting matched a search, and how to say it in one line.
 *
 * Search covers room codes, attendee names and retained chat (ADR 0020), but a
 * result row showed only the room code, date, duration and attendance — so
 * searching a person's name or a phrase from chat returned rows with no trace
 * of the thing searched for. That is the "search is not finished" report: the
 * query worked, the answer was unreadable.
 *
 * Pure, and shaped after lib/video-layout: the snippet rule is the part worth
 * testing, and it should not need a DOM or a database.
 */

/** One reason a meeting is in the result set. */
export type MeetingMatch =
  | { kind: 'code' }
  | { kind: 'attendee'; name: string }
  | { kind: 'chat'; sender: string; message: string }

export interface MatchSnippet {
  before: string
  /** The matched run, in the source's own casing. Empty when not locatable. */
  match: string
  after: string
}

/**
 * How much of a chat line a result row carries. Long enough to read the phrase
 * in context, short enough that a row stays one line on a phone.
 */
export const MATCH_SNIPPET_LENGTH = 90

/** Context kept ahead of the match, so it is not flush against the ellipsis. */
const LEAD_CONTEXT = 24

/**
 * Splits `text` around the first case-insensitive occurrence of `term`, keeping
 * a window of about `maxLength` characters around it.
 *
 * The match is returned in the source's casing rather than the query's: the
 * point is to show what was written, with the searched part identifiable.
 */
export function buildSnippet(
  text: string,
  term: string,
  maxLength: number = MATCH_SNIPPET_LENGTH,
): MatchSnippet {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  const needle = term.trim()

  // Postgres matched this row with an escaped LIKE, so the term is present
  // literally — but a caller may pass anything, and a row with no locatable
  // match should still render its text rather than nothing.
  const index =
    needle.length > 0
      ? collapsed.toLowerCase().indexOf(needle.toLowerCase())
      : -1
  if (index < 0) {
    return { before: truncateEnd(collapsed, maxLength), match: '', after: '' }
  }

  const match = collapsed.slice(index, index + needle.length)
  const start = Math.max(0, index - LEAD_CONTEXT)
  const before = (start > 0 ? '…' : '') + collapsed.slice(start, index)
  // Whatever the window has left once the lead and the match are spent.
  const room = Math.max(0, maxLength - before.length - match.length)
  const after = truncateEnd(collapsed.slice(index + match.length), room)

  return { before, match, after }
}

function truncateEnd(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

/**
 * How long to wait after the last keystroke before searching.
 *
 * Live search rather than a button press: the corpus is one signed-in user's own
 * meeting history, scoped by organiser id on an indexed column and capped at 20
 * rows, so a keystroke-rate query is cheap — and a search box that does nothing
 * until you find its button is the complaint that started this. Enter still
 * searches immediately, so nothing waits on the timer when the user is sure.
 */
export const SEARCH_DEBOUNCE_MS = 300

/**
 * Shortest query worth sending. One character matches most of a person's
 * history, so it costs a request to tell the user nothing.
 */
export const MIN_SEARCH_LENGTH = 2

/** Whether a typed query is worth a request yet. */
export function shouldSearch(query: string): boolean {
  return query.trim().length >= MIN_SEARCH_LENGTH
}

/**
 * A one-line reason for a match, ready to render.
 *
 * A room-code match needs no line: the code is already the row's heading, so
 * repeating it under itself is noise.
 */
export interface MatchDescription {
  kind: 'attendee' | 'chat'
  /** Who — an attendee's name, or a chat message's sender. */
  label: string
  snippet: MatchSnippet | null
}

export function describeMatches(
  matches: MeetingMatch[],
  term: string,
): MatchDescription[] {
  const described: MatchDescription[] = []
  for (const match of matches) {
    if (match.kind === 'attendee') {
      described.push({
        kind: 'attendee',
        label: match.name,
        // The name IS the match, so highlighting inside it is what shows why.
        snippet: buildSnippet(match.name, term),
      })
    } else if (match.kind === 'chat') {
      described.push({
        kind: 'chat',
        label: match.sender,
        snippet: buildSnippet(match.message, term),
      })
    }
  }
  return described
}
