import { searchConceptsSchema, type SearchQuery } from './search'

interface SearchableEvent {
  id: string
  title: string
  description?: string | null
  location?: string | null
  startDate: Date | string
  categoryId?: string | null
}

function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Latin words need boundaries (trip must not match strip); CJK stays a substring. */
function includes(haystack: string, needle: string): boolean {
  if (/^[\p{Script=Latin}\p{N}\s'-]+$/u.test(needle)) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(
      `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
      'u',
    ).test(haystack)
  }
  return haystack.includes(needle)
}

/**
 * The model writes the variants, but it can still miss one, and a missed
 * variant would silently delete a real event. So a term also counts when the
 * stored text is an extension of it (coffee matches "coffee break"), which is
 * how people actually name things.
 */
function termHits(text: string, term: string): boolean {
  if (!text || !term) return false
  if (includes(text, term)) return true
  return term.length >= 3 && text.length >= 3 && includes(term, text)
}

/** Field weights. A title match is a stronger signal than a description mention. */
const TITLE = 6
const LOCATION = 5
const CATEGORY = 3
const DESCRIPTION = 2

/** Matching every concept outranks matching one loudly; worth more than a field. */
const COVERAGE_BONUS = 4

interface Scored<T> {
  event: T
  score: number
  /** How many concept groups this event matched, and how many there were. */
  matches: number
  of: number
}

function scoreAll<T extends SearchableEvent>(
  events: readonly T[],
  concepts: string[][],
  categoryNames: ReadonlyMap<string, string>,
): Scored<T>[] {
  const groups = searchConceptsSchema
    .parse(concepts)
    .map((group) => [...new Set(group.map(normalize).filter(Boolean))])
  if (groups.length === 0) return []
  return events
    .map((event) => {
      const fields: readonly (readonly [string, number])[] = [
        [normalize(event.title), TITLE],
        [normalize(event.location ?? ''), LOCATION],
        [
          normalize(
            event.categoryId ? (categoryNames.get(event.categoryId) ?? '') : '',
          ),
          CATEGORY,
        ],
        [normalize(event.description ?? ''), DESCRIPTION],
      ]
      let score = 0
      let matchedGroups = 0
      for (const group of groups) {
        let best = 0
        for (const term of group) {
          for (const [text, weight] of fields) {
            if (termHits(text, term)) {
              // Only title/location whole-field matches earn the equality
              // bonus: a description that merely repeats the word is not a
              // stronger signal than the same word inside a title.
              const equality =
                text === term && (weight === TITLE || weight === LOCATION)
              best = Math.max(best, weight + (equality ? 2 : 0))
            }
          }
        }
        if (best > 0) matchedGroups += 1
        score += best
      }
      // The coverage bonus only makes sense across several concepts: it says
      // "this matched everything the user named". A single concept cannot
      // cover anything, so it would only inflate a lone weak hit.
      if (groups.length > 1 && matchedGroups === groups.length) {
        score += groups.length * COVERAGE_BONUS
      }
      return { event, score, matches: matchedGroups, of: groups.length }
    })
    .filter((entry) => entry.score > 0)
}

function compare<T extends SearchableEvent>(
  order: SearchQuery['order'],
): (a: Scored<T>, b: Scored<T>) => number {
  return (a, b) => {
    // Relevance order leads with the score; the others lead with the date, and
    // fall back to the score so equally-dated rows still read best-first.
    if (order === 'relevance' && a.score !== b.score) return b.score - a.score
    const time =
      new Date(a.event.startDate).getTime() -
      new Date(b.event.startDate).getTime()
    if (time) return order === 'next' ? time : -time
    if (a.score !== b.score) return b.score - a.score
    return a.event.id.localeCompare(b.event.id)
  }
}

/**
 * Scores every candidate against the user's concepts instead of filtering by
 * them. Boolean filtering is what made "喝咖啡" and "咖啡" return different
 * calendars: a concept the model phrased slightly differently vetoed the event
 * outright. Scoring keeps it, just lower, and the ranking decides.
 *
 * Runs once over decrypted candidates, before pagination. No per-term DB reads.
 */
export function rankSearchEvents<T extends SearchableEvent>(
  events: readonly T[],
  concepts: string[][],
  order: SearchQuery['order'],
  categoryNames: ReadonlyMap<string, string> = new Map(),
): T[] {
  return scoreAll(events, concepts, categoryNames)
    .sort(compare<T>(order))
    .map(({ event }) => event)
}

/**
 * A relative cutoff, so a common word ("coffee") does not return the whole
 * calendar while a rare one still returns everything it found: keep anything at
 * least this fraction as relevant as the best hit. 0.3 holds the line between
 * "a description that shares every concept" (worth keeping) and "a lone
 * mention of one word" (noise that happened to be the best of nothing).
 */
const RELEVANCE_FLOOR = 0.3

/**
 * The floor alone collapses when the best hit is itself weak, and a concept the
 * user named is an AND. So a multi-concept query also requires every concept to
 * land — an event matching only "旅行" is not an answer to "东京旅行". A
 * single-concept query needs no such bar; the floor already trims its tail.
 */
function isStrong(matchedGroups: number, total: number): boolean {
  return total > 1 ? matchedGroups === total : true
}

/** Ranks, then drops the tail that only matched by a long shot. */
export function rankAndTrim<T extends SearchableEvent>(
  events: readonly T[],
  concepts: string[][],
  order: SearchQuery['order'],
  categoryNames: ReadonlyMap<string, string> = new Map(),
): T[] {
  const scored = scoreAll(events, concepts, categoryNames)
  if (scored.length === 0) return []
  const top = Math.max(...scored.map((entry) => entry.score))
  const floor = top * RELEVANCE_FLOOR
  return scored
    .filter(
      (entry) => entry.score >= floor && isStrong(entry.matches, entry.of),
    )
    .sort(compare<T>(order))
    .map(({ event }) => event)
}
