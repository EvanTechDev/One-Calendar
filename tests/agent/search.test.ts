import { describe, expect, it } from 'vitest'
import { toJSONSchema } from 'zod'
import {
  sanitizeSearchQuery,
  searchQuerySchema,
  resolvedSearchQuerySchema,
  type RawSearchQuery,
} from '@zntr/agent/search'

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
  it('allows no extracted keywords because AI still judges the original question', () => {
    expect(compile({})).toEqual({
      concepts: [],
      order: 'relevance',
      browse: false,
    })
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
