import { describe, expect, it } from 'vitest'
import { toJSONSchema } from 'zod'
import {
  sanitizeSearchQuery,
  searchQuerySchema,
  resolvedSearchQuerySchema,
  type RawSearchQuery,
} from '@zntr/agent/search'
import {
  rankAndTrim,
  rankSearchEvents,
} from '../../packages/agent/src/search-ranking'

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
  it('ranks a full-concept match above one that only shares a concept', () => {
    const events = [
      row('trip', 'Trip', { location: 'ＴＯＫＹＯ' }),
      row('other', 'Trip to Paris'),
      row('office', 'Tokyo office'),
    ]
    // Scoring replaced vetoing: the row matching BOTH concepts leads, and a
    // row sharing only one is kept but ranked lower, never deleted.
    expect(
      rankSearchEvents(
        events,
        [
          ['东京', 'Tokyo'],
          ['trip', '旅行'],
        ],
        'relevance',
      ).map((e) => e.id),
    ).toEqual(['trip', 'office', 'other'])
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
  it('keeps a description that shares every concept, drops a lone mention', () => {
    const shared = row('shared', 'Team sync', { description: 'company report' })
    const lone = row('lone', 'Team sync', { description: 'report' })
    const title = row('title', 'Company report')
    // "company report" states both concepts (kept); "report" alone does not.
    expect(
      rankAndTrim([shared, lone, title], [['company'], ['report']], 'relevance')
        .map((e) => e.id)
        .sort(),
    ).toEqual(['shared', 'title'])
  })
  it('a single-concept search never demands a title hit', () => {
    // "咖啡" as a description is a real result; only the relative floor trims
    // the tail, and with nothing stronger to compare against it survives.
    expect(
      rankAndTrim(
        [row('desc', 'Team sync', { description: 'coffee' })],
        [['咖啡', 'coffee']],
        'relevance',
      ).map((e) => e.id),
    ).toEqual(['desc'])
  })
  it('weights the category name and location, not only the title', () => {
    const cats = new Map([['cat-work', 'Work']])
    const events = [
      row('byCategory', 'Standup', { categoryId: 'cat-work' }),
      row('unrelated', 'Lunch'),
    ]
    expect(
      rankAndTrim(events, [['Work']], 'relevance', cats).map((e) => e.id),
    ).toEqual(['byCategory'])
  })
  it('a bidirectional substring still finds the event when the model missed a variant', () => {
    // The model emitted "coffee", the event says "coffee break": termHits
    // matches the stored text as an extension of the term.
    expect(
      rankAndTrim(
        [row('break', 'Coffee break'), row('other', 'Lunch')],
        [['coffee']],
        'relevance',
      ).map((e) => e.id),
    ).toEqual(['break'])
  })
})
