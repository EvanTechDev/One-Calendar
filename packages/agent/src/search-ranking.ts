import { searchConceptsSchema, type SearchQuery } from './search'

interface SearchableEvent {
  id: string
  title: string
  description?: string | null
  location?: string | null
  startDate: Date | string
}

function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

function matcher(term: string): (text: string) => boolean {
  // Latin words need boundaries (trip must not match strip). CJK phrases
  // remain substrings because their words are not separated by spaces.
  if (/^[\p{Script=Latin}\p{N}\s'-]+$/u.test(term)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
      'u',
    )
    return (text) => pattern.test(text)
  }
  return (text) => text.includes(term)
}

/** Runs once over decrypted candidates, BEFORE pagination. No per-term DB reads. */
export function rankSearchEvents<T extends SearchableEvent>(
  events: readonly T[],
  concepts: string[][],
  order: SearchQuery['order'],
): T[] {
  const groups = searchConceptsSchema.parse(concepts).map((group) =>
    [...new Set(group.map(normalize))].map((word) => ({
      word,
      matches: matcher(word),
    })),
  )
  const scored = events.flatMap((event) => {
    const fields = [
      [normalize(event.title), 6],
      [normalize(event.location ?? ''), 5],
      [normalize(event.description ?? ''), 2],
    ] as const
    let score = 0
    for (const group of groups) {
      let best = 0
      for (const { word, matches } of group) {
        for (const [text, weight] of fields) {
          if (matches(text))
            best = Math.max(best, weight + (text === word ? 2 : 0))
        }
      }
      if (!best) return [] // Every concept is mandatory; score cannot compensate for a missing one.
      score += best
    }
    return [{ event, score }]
  })
  scored.sort((a, b) => {
    if (order === 'relevance' && a.score !== b.score) return b.score - a.score
    const time =
      new Date(a.event.startDate).getTime() -
      new Date(b.event.startDate).getTime()
    if (time) return order === 'next' ? time : -time
    return a.event.id.localeCompare(b.event.id)
  })
  return scored.map(({ event }) => event)
}
