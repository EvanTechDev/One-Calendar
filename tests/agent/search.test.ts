import { describe, expect, it } from 'vitest'
import { toJSONSchema } from 'zod'
import {
  sanitizeSearchQuery,
  searchQuerySchema,
  resolvedSearchQuerySchema,
  extendSearchQuery,
  searchRecoverySchema,
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
  it.each([
    '2026-08-13T09:00Z',
    '2026-08-13T09:00+08:00',
    '2026-08-13T09:00:00Z',
    '2026-08-13T09:00:00.123+08:00',
  ])('keeps existing search tokens valid with datetime %s', (start) => {
    const query = { concepts: [], start, order: 'relevance', browse: false }
    expect(resolvedSearchQuerySchema.parse(query)).toEqual(query)
  })

  it('keeps the strict gateway contract with all keys required', () => {
    const schema = toJSONSchema(searchQuerySchema)
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual(Object.keys(empty))
  })
  it('rejects an empty search unless an explicit browse or constraint exists', () => {
    expect(() => compile({})).toThrow('No search constraints')
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

describe('zero-result recovery stays inside the original search', () => {
  const query = compile({
    concepts: [['东京', 'Tokyo'], ['旅游']],
    preset: 'this_year',
    names: ['Alex'],
  })
  it('adds expressions without losing the original terms or hard constraints', () => {
    const recovered = extendSearchQuery(query, {
      concepts: [['TOKYO'], ['flight', 'airport transfer']],
    })
    expect(recovered).toEqual({
      ...query,
      concepts: [
        ['东京', 'Tokyo'],
        ['旅游', 'flight', 'airport transfer'],
      ],
    })
    expect(query.concepts).toEqual([['东京', 'Tokyo'], ['旅游']])
    expect(resolvedSearchQuerySchema.parse(recovered)).toEqual(recovered)
  })
  it('cannot drop a subject, switch to browse or alter the time range', () => {
    for (const recovery of [
      { concepts: [] },
      { concepts: [['旅行']] },
      { concepts: [[], ['旅行']] },
      { concepts: [['东京'], ['旅行']], browse: true },
      { concepts: [['东京'], ['旅行']], start: '2020-01-01T00:00:00Z' },
    ])
      expect(() => extendSearchQuery(query, recovery)).toThrow()
    const schema = toJSONSchema(searchRecoverySchema)
    expect(schema.required).toEqual(['concepts'])
    expect(schema.additionalProperties).toBe(false)
  })
  it('fits both sets of expressions in the sealed paging plan', () => {
    const original = compile({
      concepts: [Array.from({ length: 12 }, (_, i) => `term${i}`)],
    })
    const recovered = extendSearchQuery(original, {
      concepts: [Array.from({ length: 12 }, (_, i) => `translation${i}`)],
    })
    expect(recovered.concepts[0]).toHaveLength(24)
    expect(resolvedSearchQuerySchema.parse(recovered)).toEqual(recovered)
  })
})
