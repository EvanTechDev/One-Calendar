import { describe, expect, it } from 'vitest'
import {
  buildSearchPlan,
  hasAnyFilter,
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

describe('the needle', () => {
  it('strips the quoting a model adds around the words it kept', () => {
    expect(
      sanitizeSearchQuery(raw({ query: '  "旅游" ' }), { categories }).query,
    ).toBe('旅游')
    expect(
      sanitizeSearchQuery(raw({ query: '「项目」' }), { categories }).query,
    ).toBe('项目')
  })

  it('collapses the whitespace and drops a punctuation-only needle', () => {
    expect(
      sanitizeSearchQuery(raw({ query: 'budget   review' }), { categories })
        .query,
    ).toBe('budget review')
    expect(
      sanitizeSearchQuery(raw({ query: '（）「」' }), { categories }).query,
    ).toBeUndefined()
  })

  it('drops a needle that is longer than the search can use', () => {
    const long = 'a'.repeat(260)
    expect(
      sanitizeSearchQuery(raw({ query: long }), { categories }).query,
    ).toBeUndefined()
  })
})

describe('hasAnyFilter', () => {
  it('an all-null query has no filter, which is what the endpoint bounds', () => {
    expect(hasAnyFilter(sanitizeSearchQuery(EMPTY, { categories }))).toBe(false)
  })

  it('any single filter counts', () => {
    for (const query of [
      { preset: 'last_month' },
      { start: '2026-01-01T00:00:00.000Z' },
      { end: '2026-01-01T00:00:00.000Z' },
      { query: 'x' },
      { names: ['alex'] },
      { categoryIds: ['cat-fin'] },
    ]) {
      expect(hasAnyFilter(query)).toBe(true)
    }
  })
})

describe('buildSearchPlan', () => {
  const range = {
    start: '2026-01-01T00:00:00.000Z',
    end: '2026-02-01T00:00:00.000Z',
  }

  it('starts with the query as written, then widens one filter at a time', () => {
    const plan = buildSearchPlan(
      {
        query: '旅游',
        names: ['alex'],
        categoryIds: ['cat-fin'],
        preset: 'last_year',
      },
      range,
    )
    expect(plan.map((a) => a.relaxed)).toEqual([
      null,
      'names',
      'categories',
      'range',
      'keyword',
    ])
  })

  it('never widens into an unbounded listing', () => {
    // No keyword, no names, no categories: dropping anything would turn this
    // into "every event you have ever had".
    expect(buildSearchPlan({ preset: 'last_year' }, range)).toHaveLength(1)
    expect(buildSearchPlan({}, {})).toHaveLength(1)
  })

  it('never drops the keyword in a window too wide to browse', () => {
    const wide = {
      start: '2020-01-01T00:00:00.000Z',
      end: '2026-01-01T00:00:00.000Z',
    }
    // The range may go — a keyword still has to match — the keyword may not.
    expect(
      buildSearchPlan({ query: '旅游' }, wide).map((a) => a.relaxed),
    ).toEqual([null, 'range'])
  })

  it('drops the keyword last, and only in a window that can be browsed', () => {
    const plan = buildSearchPlan({ query: '旅游' }, range)
    expect(plan.map((a) => a.relaxed)).toEqual([null, 'range', 'keyword'])
    // The last attempt is the whole window, which is only safe because it is
    // short: a season of calendar is browsable, six years is not.
    expect(plan[2].query).toEqual({})
  })
})
