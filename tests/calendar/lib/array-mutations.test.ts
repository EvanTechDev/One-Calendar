import { describe, it, expect } from 'vitest'
import { upsertById, upsertBy, removeById } from '@/lib/array-mutations'

describe('upsertById', () => {
  it('replaces an item with a matching id in place', () => {
    const input = [
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ]
    const next = upsertById(input, { id: 'a', n: 9 })
    expect(next).toEqual([
      { id: 'a', n: 9 },
      { id: 'b', n: 2 },
    ])
    expect(input).toHaveLength(2)
  })

  it('appends when no id matches', () => {
    const input = [{ id: 'a', n: 1 }]
    const next = upsertById(input, { id: 'c', n: 3 })
    expect(next).toEqual([
      { id: 'a', n: 1 },
      { id: 'c', n: 3 },
    ])
  })

  it('does not mutate the input list', () => {
    const input = [{ id: 'a', n: 1 }]
    upsertById(input, { id: 'b', n: 2 })
    expect(input).toHaveLength(1)
  })
})

describe('upsertBy', () => {
  it('replaces the matching item in place', () => {
    const input = [{ eventId: 'x', title: 'old' }]
    const next = upsertBy(
      input,
      { eventId: 'x', title: 'new' },
      (e) => e.eventId === 'x',
    )
    expect(next).toEqual([{ eventId: 'x', title: 'new' }])
  })

  it('prepends when no match, so the freshest entry surfaces first', () => {
    const input = [{ eventId: 'y', title: 'keep' }]
    const next = upsertBy(
      input,
      { eventId: 'x', title: 'added' },
      (e) => e.eventId === 'x',
    )
    expect(next).toEqual([
      { eventId: 'x', title: 'added' },
      { eventId: 'y', title: 'keep' },
    ])
  })

  it('keeps the input list untouched', () => {
    const input = [{ eventId: 'x', title: 'old' }]
    upsertBy(input, { eventId: 'y', title: 'new' }, (e) => e.eventId === 'y')
    expect(input).toHaveLength(1)
  })
})

describe('removeById', () => {
  it('drops the item with the matching id', () => {
    const input = [{ id: 'a' }, { id: 'b' }]
    const next = removeById(input, 'a')
    expect(next).toEqual([{ id: 'b' }])
  })

  it('returns the list unchanged when the id is absent', () => {
    const input = [{ id: 'a' }]
    expect(removeById(input, 'zzz')).toEqual(input)
  })
})
