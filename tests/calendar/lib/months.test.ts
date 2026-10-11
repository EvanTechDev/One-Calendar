import { describe, expect, it } from 'vitest'
import { affectedMonths } from '@/lib/months'

/**
 * The months a requested range touches.
 *
 * This decides which rows the events query has to look at. A month missing from
 * the list is excluded by the range filter, so an event stored in it is invisible
 * to a request that should have found it.
 */
describe('affectedMonths', () => {
  it('covers the months a range spans', () => {
    expect(
      affectedMonths('2026-05-10T00:00:00Z', '2026-07-02T00:00:00Z'),
    ).toEqual(['2026-05', '2026-06', '2026-07'])
  })

  it('returns the single month for a range inside one month', () => {
    expect(
      affectedMonths('2026-05-10T00:00:00Z', '2026-05-20T00:00:00Z'),
    ).toEqual(['2026-05'])
  })

  it('does not skip the month after a 31st', () => {
    // setUTCMonth from 31 January normalises to 3 March, because February has
    // 28 days — so February was never added and its rows were never read.
    expect(
      affectedMonths('2026-01-31T00:00:00Z', '2026-01-31T23:00:00Z'),
    ).toEqual(['2026-01'])
    expect(
      affectedMonths('2026-01-31T00:00:00Z', '2026-02-01T00:00:00Z'),
    ).toEqual(['2026-01', '2026-02'])
  })

  it('does not skip April when starting on 31 March', () => {
    expect(
      affectedMonths('2026-03-31T00:00:00Z', '2026-04-30T00:00:00Z'),
    ).toEqual(['2026-03', '2026-04'])
  })

  it('covers every month of a long range that starts on the 31st', () => {
    // The regression this file exists for: a range walking from 31 January
    // used to return January, March, May… and lose every other month.
    const months = affectedMonths(
      '2026-01-31T00:00:00Z',
      '2026-06-30T00:00:00Z',
    )
    expect(months).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ])
  })

  it('crosses a year boundary', () => {
    expect(
      affectedMonths('2025-11-15T00:00:00Z', '2026-02-01T00:00:00Z'),
    ).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('crosses a leap day', () => {
    expect(
      affectedMonths('2028-02-01T00:00:00Z', '2028-03-05T00:00:00Z'),
    ).toEqual(['2028-02', '2028-03'])
  })

  it('returns one month for a zero-length range', () => {
    expect(
      affectedMonths('2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z'),
    ).toEqual(['2026-09'])
  })

  it('returns nothing for an unparseable bound rather than looping forever', () => {
    expect(affectedMonths('not-a-date', 'also-not-a-date')).toEqual([])
  })

  it('is never empty for a valid range', () => {
    // The failure mode that matters: an empty list clears nothing, so a write
    // silently leaves its own month cached.
    for (const start of [
      '2026-01-31T00:00:00Z',
      '2026-03-31T00:00:00Z',
      '2026-08-31T00:00:00Z',
      '2027-01-31T00:00:00Z',
    ]) {
      expect(affectedMonths(start, start).length).toBeGreaterThan(0)
    }
  })
})
