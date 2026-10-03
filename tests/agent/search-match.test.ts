import { describe, expect, it } from 'vitest'
import { matchSearchEvents } from '@zntr/agent/search-match'
import type { AgentEventSummary } from '@zntr/agent/types'
import type { SearchQuery } from '@zntr/agent/search'

const row = (
  id: string,
  extra: Partial<AgentEventSummary> = {},
): AgentEventSummary => ({
  id,
  title: id,
  startDate: '2026-04-12T08:00:00Z',
  endDate: '2026-04-12T09:00:00Z',
  isAllDay: false,
  ...extra,
})
const query = (
  concepts: string[][],
  order: SearchQuery['order'] = 'relevance',
): SearchQuery => ({ concepts, order, browse: false })

describe('compiled search executes locally over every candidate', () => {
  it('combines fields and keeps low-scoring matches, even beyond 200 candidates', () => {
    const rows = Array.from({ length: 205 }, (_, i) => row(`noise-${i}`))
    rows.push(
      row('direct', { title: 'Tokyo travel' }),
      row('category', { location: 'Tokyo', categoryId: 'travel' }),
      row('description', { description: 'Tokyo travel' }),
      row('participant', { participants: [{ name: 'Tokyo travel' }] }),
    )
    expect(
      matchSearchEvents(
        rows,
        query([['Tokyo'], ['travel']]),
        new Map([['travel', 'Travel']]),
      ).map((e) => e.id),
    ).toEqual(['direct', 'category', 'description', 'participant'])
  })
  it('supports cross-language alternatives without weakening the destination', () => {
    const rows = [
      row('tokyo', { title: 'Flight to Tokyo' }),
      row('osaka', { title: 'Flight to Osaka' }),
      row('hike', { title: 'Weekend hiking trip' }),
    ]
    expect(
      matchSearchEvents(
        rows,
        query([
          ['东京', 'Tokyo'],
          ['旅行', 'flight', 'trip'],
        ]),
        new Map(),
      ).map((e) => e.id),
    ).toEqual(['tokyo'])
  })
  it('normalizes case, accents and punctuation but never Latin substrings or empty terms', () => {
    const rows = [
      row('strip'),
      row('trip'),
      row('cafe', { title: 'CAFÉ' }),
      row('dog', { title: 'Walk-the-dog' }),
    ]
    for (const [term, expected] of [
      ['trip', 'trip'],
      ['cafe', 'cafe'],
      ['walk the dog', 'dog'],
    ])
      expect(
        matchSearchEvents(rows, query([[term]]), new Map()).map((e) => e.id),
      ).toEqual([expected])
    expect(matchSearchEvents(rows, query([['!!!']]), new Map())).toEqual([])
  })
  it('orders next/latest by date and resolves ties deterministically', () => {
    const rows = [
      row('late', { title: 'trip', startDate: '2026-05-01T00:00:00Z' }),
      row('b', { title: 'trip' }),
      row('a', { title: 'trip' }),
    ]
    expect(
      matchSearchEvents(rows, query([['trip']], 'next'), new Map()).map(
        (e) => e.id,
      ),
    ).toEqual(['a', 'b', 'late'])
    expect(
      matchSearchEvents(rows, query([['trip']], 'latest'), new Map()).map(
        (e) => e.id,
      ),
    ).toEqual(['late', 'a', 'b'])
  })
})
