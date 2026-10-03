import { describe, expect, it } from 'vitest'
import {
  sanitizeSearchQuery,
  searchQuerySchema,
  type RawSearchQuery,
} from '@zntr/agent/search'
import { toJSONSchema } from 'zod'

/**
 * Every field null: the shape the model returns when the user just said
 * "search". It is a valid result, not a failure, so the app falls back to a
 * plain listing.
 */
const EMPTY: RawSearchQuery = {
  preset: null,
  start: null,
  end: null,
  query: null,
  names: null,
  categories: null,
}

const categories = [
  { id: 'cat-fin', name: '财务', color: '#3b82f6' },
  { id: 'cat-work', name: 'Work', color: '#10b981' },
]

const raw = (over: Partial<RawSearchQuery> = {}): RawSearchQuery => ({
  ...EMPTY,
  ...over,
})

describe('searchQuerySchema', () => {
  it('is gateway-safe in the strict mode generateObject sends', () => {
    // Groq rejects a json_schema whose objects are open or whose keys are not
    // all required — one 400 loses the whole search. `.nullable()` is what puts
    // a key in `required`; `.optional()` would not have.
    const schema = toJSONSchema(searchQuerySchema) as Record<string, unknown>
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual([
      'preset',
      'start',
      'end',
      'query',
      'names',
      'categories',
    ])
    const props = schema.properties as Record<string, Record<string, unknown>>
    // An enum is the other thing a model breaks by inventing a value.
    for (const [name, prop] of Object.entries(props)) {
      expect(prop.enum, `${name} must not be an enum`).toBeUndefined()
    }
  })

  it('parses an all-null object, which is the "just search" answer', () => {
    expect(searchQuerySchema.parse(EMPTY)).toEqual(EMPTY)
  })
})

describe('sanitizeSearchQuery', () => {
  it('passes a good query through', () => {
    expect(
      sanitizeSearchQuery(
        raw({ preset: 'last_year', query: '项目', names: ['Alex'] }),
        { categories },
      ),
    ).toEqual({ preset: 'last_year', query: '项目', names: ['Alex'] })
  })

  it('returns {} for an all-null answer rather than failing', () => {
    expect(sanitizeSearchQuery(EMPTY, { categories })).toEqual({})
  })

  it('normalises the preset through the same alias table the tool uses', () => {
    // Otherwise search and chat would read "recent" as two different spans.
    expect(
      sanitizeSearchQuery(raw({ preset: ' Recently ' }), { categories }),
    ).toEqual({ preset: 'last_30_days' })
    expect(sanitizeSearchQuery(raw({ preset: 'ytd' }), { categories })).toEqual(
      { preset: 'this_year' },
    )
  })

  it('drops an invented preset instead of failing the search', () => {
    expect(
      sanitizeSearchQuery(raw({ preset: 'sometime_soon', query: 'lunch' }), {
        categories,
      }),
    ).toEqual({ query: 'lunch' })
  })

  it('drops an unparseable instant and keeps the other filters', () => {
    expect(
      sanitizeSearchQuery(raw({ start: 'last tuesday', query: 'retro' }), {
        categories,
      }),
    ).toEqual({ query: 'retro' })
  })

  it('drops BOTH ends of an inverted range', () => {
    // start > end returns nothing, and here "nothing" would read as "you have
    // no such meeting". Degrading to unfiltered is the honest answer.
    expect(
      sanitizeSearchQuery(
        raw({
          start: '2026-03-20T00:00:00+08:00',
          end: '2026-03-01T00:00:00+08:00',
          query: 'retro',
        }),
        { categories },
      ),
    ).toEqual({ query: 'retro' })
  })

  it('drops a zero-length range', () => {
    expect(
      sanitizeSearchQuery(
        raw({
          start: '2026-03-01T00:00:00+08:00',
          end: '2026-03-01T00:00:00+08:00',
        }),
        { categories },
      ),
    ).toEqual({})
  })

  it('keeps an open range, which is a real question ("everything since March")', () => {
    expect(
      sanitizeSearchQuery(raw({ start: '2026-03-01T00:00:00+08:00' }), {
        categories,
      }),
    ).toEqual({ start: '2026-02-28T16:00:00.000Z' })
  })

  it('lets the preset win over start/end, and drops the instants', () => {
    // A preset already IS the range. Keeping both would let the app resolve one
    // and silently drop the other.
    expect(
      sanitizeSearchQuery(
        raw({
          preset: 'last_month',
          start: '2026-08-01T00:00:00+08:00',
          end: '2026-09-01T00:00:00+08:00',
        }),
        { categories },
      ),
    ).toEqual({ preset: 'last_month' })
  })

  it('drops a query longer than the search can use', () => {
    expect(
      sanitizeSearchQuery(raw({ query: 'x'.repeat(201) }), { categories }),
    ).toEqual({})
  })

  it('cleans the name list: trims, dedupes case-insensitively, caps the count', () => {
    expect(
      sanitizeSearchQuery(
        raw({ names: [' Alex ', 'alex', 'Bo', '', '  ', 'x'.repeat(61)] }),
        { categories },
      ).names,
    ).toEqual(['Alex', 'Bo'])
    expect(
      sanitizeSearchQuery(raw({ names: ['a', 'b', 'c', 'd', 'e', 'f'] }), {
        categories,
      }).names,
    ).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('resolves category names to ids and drops invented ones', () => {
    expect(
      sanitizeSearchQuery(raw({ categories: ['财务', 'Work'] }), {
        categories,
      }),
    ).toEqual({ categoryIds: ['cat-fin', 'cat-work'] })
    // The model will invent a name; matching nothing is the correct outcome
    // and must not take the other filters down with it.
    expect(
      sanitizeSearchQuery(raw({ categories: ['不存在'], query: '财务' }), {
        categories,
      }),
    ).toEqual({ query: '财务' })
  })

  it('falls back to a substring match on the category name', () => {
    expect(
      sanitizeSearchQuery(raw({ categories: ['work'] }), { categories }),
    ).toEqual({ categoryIds: ['cat-work'] })
  })

  it('cannot resolve categories when the user has none', () => {
    expect(
      sanitizeSearchQuery(raw({ categories: ['Work'], query: 'x' }), {
        categories: [],
      }),
    ).toEqual({ query: 'x' })
  })

  it('does not return one category twice when the model repeats it', () => {
    expect(
      sanitizeSearchQuery(raw({ categories: ['财务', '财务'] }), { categories })
        .categoryIds,
    ).toEqual(['cat-fin'])
  })
})
