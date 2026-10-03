import { describe, expect, it } from 'vitest'
import { toJSONSchema } from 'zod'
import {
  sanitizeSearchQuery,
  searchQuerySchema,
  resolvedSearchQuerySchema,
  type RawSearchQuery,
} from '@zntr/agent/search'
import { rankSearchEvents } from '../../packages/agent/src/search-ranking'

const empty: RawSearchQuery = {
  concepts: null,
  preset: null,
  start: null,
  end: null,
  names: null,
  categories: null,
  order: null,
  browse: null,
}
const context = {
  categories: [],
  timezone: 'Asia/Shanghai',
  now: new Date('2026-10-03T00:00:00Z'),
}
const compile = (fields: Partial<RawSearchQuery>) =>
  sanitizeSearchQuery({ ...empty, ...fields }, context)

describe('search compilation never silently removes a constraint', () => {
  it('keeps the strict gateway contract with all keys required', () => {
    const schema = toJSONSchema(searchQuerySchema)
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual(Object.keys(empty))
  })
  it('rejects all-null output instead of listing the entire calendar', () => {
    expect(() => compile({})).toThrow()
    expect(compile({ browse: true }).concepts).toEqual([])
  })
  it('has no implicit time window for a topical search', () => {
    expect(compile({ concepts: [['东京', 'Tokyo']] })).toMatchObject({
      concepts: [['东京', 'Tokyo']],
      order: 'relevance',
    })
    expect(compile({ concepts: [['东京']] }).start).toBeUndefined()
    expect(compile({ concepts: [['东京']] }).end).toBeUndefined()
  })
  it('rejects malformed, inverted, ambiguous ranges and empty concepts', () => {
    for (const fields of [
      { start: 'bad' },
      { preset: 'invented' },
      { start: '2026-07-01T00:00:00Z', end: '2026-04-01T00:00:00Z' },
      { preset: 'this_year', start: '2026-04-01T00:00:00Z' },
      { concepts: [[]] },
      { concepts: [['   ']] },
      { categories: ['invented'] },
    ])
      expect(() => compile({ concepts: [['报告']], ...fields })).toThrow()
  })
  it('freezes presets at the timezone boundary for reuse on every page', () => {
    const query = compile({ preset: 'this_year' })
    expect(query.start).toBe('2025-12-31T16:00:00.000Z')
    expect(query.end).toBe('2026-12-31T16:00:00.000Z')
    expect(
      resolvedSearchQuerySchema.parse(JSON.parse(JSON.stringify(query))),
    ).toEqual(query)
  })
  it('latest and next constrain direction without inventing a year', () => {
    expect(compile({ concepts: [['旅行']], order: 'latest' }).end).toBe(
      context.now.toISOString(),
    )
    expect(compile({ concepts: [['旅行']], order: 'next' }).start).toBe(
      context.now.toISOString(),
    )
    expect(
      compile({ concepts: [['旅行']], order: 'latest' }).start,
    ).toBeUndefined()
  })
})

describe('concept matching and ranking', () => {
  const row = (id: string, title: string, extra = {}) => ({
    id,
    title,
    startDate: '2026-01-01',
    ...extra,
  })
  it('requires concepts across fields and ORs only true alternatives', () => {
    const events = [
      row('trip', 'Trip', { location: 'ＴＯＫＹＯ' }),
      row('other', 'Trip to Paris'),
      row('office', 'Tokyo office'),
    ]
    expect(
      rankSearchEvents(
        events,
        [
          ['东京', 'Tokyo'],
          ['trip', '旅行'],
        ],
        'relevance',
      ).map((e) => e.id),
    ).toEqual(['trip'])
  })
  it('does not match Latin substrings inside unrelated words', () => {
    expect(
      rankSearchEvents(
        [row('bad', 'strip club'), row('good', 'TRIP')],
        [['trip']],
        'relevance',
      ).map((e) => e.id),
    ).toEqual(['good'])
  })
  it('title matches outrank description matches; latest overrides relevance', () => {
    const events = [
      row('description', 'Team sync', {
        description: 'report',
        startDate: '2026-02-01',
      }),
      row('title', 'report'),
    ]
    expect(
      rankSearchEvents(events, [['report']], 'relevance').map((e) => e.id),
    ).toEqual(['title', 'description'])
    expect(
      rankSearchEvents(events, [['report']], 'latest').map((e) => e.id),
    ).toEqual(['description', 'title'])
  })
})
