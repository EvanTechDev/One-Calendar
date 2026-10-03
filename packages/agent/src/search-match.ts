import type { AgentEventSummary } from './types'
import { searchConceptsSchema, type SearchQuery } from './search'

function normalize(text: string) {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function compileTerm(value: string) {
  const term = normalize(value)
  if (!term) return () => false
  // Latin words must not match inside other words (trip / strip). CJK phrases
  // have no reliable space boundaries, so match the intact phrase as a substring.
  const pattern = /^[\p{Script=Latin}\p{N} ]+$/u.test(term)
    ? new RegExp(`(?:^|[^\\p{L}\\p{N}])${term}(?:$|[^\\p{L}\\p{N}])`, 'u')
    : null
  return (text: string) => (pattern ? pattern.test(text) : text.includes(term))
}

function participantText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value
    .map((person) => {
      if (typeof person === 'string') return person
      if (!person || typeof person !== 'object') return ''
      return [person.name, person.email]
        .filter((part) => typeof part === 'string')
        .join(' ')
    })
    .join(' ')
}

/** One compiled query, a complete local scan, then ranking. No model per event. */
export function matchSearchEvents(
  events: readonly AgentEventSummary[],
  query: SearchQuery,
  categoryNames: ReadonlyMap<string, string>,
): AgentEventSummary[] {
  const groups = searchConceptsSchema
    .parse(query.concepts)
    .map((terms) => terms.map(compileTerm))
  const matches: { event: AgentEventSummary; score: number }[] = []
  for (const event of events) {
    const fields = [
      [event.title, 6],
      [event.location, 5],
      [event.categoryId ? categoryNames.get(event.categoryId) : '', 3],
      [event.description, 2],
      [participantText(event.participants), 2],
    ].map(([text, weight]) => ({
      text: normalize(String(text ?? '')),
      weight: Number(weight),
    }))
    let score = 0
    let matched = true
    for (const alternatives of groups) {
      let best = 0
      for (const field of fields) {
        if (field.text && alternatives.some((test) => test(field.text)))
          best = Math.max(best, field.weight)
      }
      // Required subjects can occur in different fields. Never drop a subject
      // just because another candidate got a higher score, or no result matched.
      if (!best) {
        matched = false
        break
      }
      score += best
    }
    if (matched) matches.push({ event, score })
  }
  // Every match survives; scores order results, never truncate the long tail.
  return matches
    .sort((a, b) => {
      if (query.order === 'relevance' && a.score !== b.score)
        return b.score - a.score
      const time = Date.parse(a.event.startDate) - Date.parse(b.event.startDate)
      return (
        (query.order === 'next' ? time : -time) ||
        b.score - a.score ||
        a.event.id.localeCompare(b.event.id)
      )
    })
    .map(({ event }) => event)
}
