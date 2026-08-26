import { describe, it, expect } from 'vitest'
import { filterCachedByCategory, resolveEventSource } from '@/lib/cache/events'

/**
 * A cache hit that happens to be empty is still a hit.
 *
 * `getCachedEvents` deliberately distinguishes `null` (nothing cached) from `[]`
 * (cached, and that range genuinely holds no events). The events route collapsed
 * the two by testing `decrypted.length === 0`, which had two consequences for an
 * empty month:
 *
 * 1. Every request for it queried the database, so the cache never helped the
 *    case it should help most.
 * 2. Worse, the date filters were skipped on the cache-hit branch, so the
 *    fallback query ran **unfiltered** — reading the user's entire event history
 *    and writing it back into per-month cache keys.
 *
 * The second is why this is a correctness bug and not only a performance one.
 */
describe('resolveEventSource', () => {
  it('uses the cache when it holds events', () => {
    expect(resolveEventSource([{} as never])).toBe('cache')
  })

  it('uses the cache when it holds an empty range', () => {
    // The bug. An empty array means "cached, and empty" — asking the database
    // cannot produce a better answer.
    expect(resolveEventSource([])).toBe('cache')
  })

  it('queries the database when nothing is cached', () => {
    expect(resolveEventSource(null)).toBe('database')
  })

  it('queries the database when the cache is unavailable', () => {
    // `withRedis` falls back to null, which is the same signal as a miss.
    expect(resolveEventSource(undefined)).toBe('database')
  })
})

describe('filterCachedByCategory', () => {
  const event = (id: string, categoryId: string | null) =>
    ({ id, categoryId }) as never

  it('returns everything when no category is requested', () => {
    const events = [event('a', 'work'), event('b', null)]
    expect(filterCachedByCategory(events, null)).toEqual(events)
    expect(filterCachedByCategory(events, [])).toEqual(events)
  })

  it('keeps only the requested categories', () => {
    // The bug: the categoryId filter is pushed into the DATABASE query, so on a
    // cache hit it did nothing and a filtered request got the whole month.
    const events = [event('a', 'work'), event('b', 'home'), event('c', 'work')]
    expect(filterCachedByCategory(events, ['work']).map((e) => e.id)).toEqual([
      'a',
      'c',
    ])
  })

  it('accepts several categories, matching the comma-separated parameter', () => {
    const events = [event('a', 'work'), event('b', 'home'), event('c', 'gym')]
    expect(
      filterCachedByCategory(events, ['work', 'gym']).map((e) => e.id),
    ).toEqual(['a', 'c'])
  })

  it('excludes uncategorised events when a category is requested', () => {
    // A null category is not a match for any named one. Including it would show
    // events the user filtered away.
    const events = [event('a', 'work'), event('b', null)]
    expect(filterCachedByCategory(events, ['work']).map((e) => e.id)).toEqual([
      'a',
    ])
  })

  it('returns nothing when no cached event matches', () => {
    const events = [event('a', 'work')]
    expect(filterCachedByCategory(events, ['nope'])).toEqual([])
  })
})
