import { describe, expect, it } from 'vitest'
import { parseDateQuery } from '@/lib/parse-date-query'

/** Pinned so a bare `1/1` cannot drift with the day the suite runs. */
const TODAY = new Date(2026, 9, 3) // 3 October 2026, local

const iso = (date: Date | null) =>
  date === null
    ? null
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

describe('parseDateQuery', () => {
  it('reads the relative words, in both languages, at local midnight', () => {
    expect(iso(parseDateQuery('today', TODAY))).toBe('2026-10-03')
    expect(iso(parseDateQuery('Today', TODAY))).toBe('2026-10-03')
    expect(iso(parseDateQuery('tomorrow', TODAY))).toBe('2026-10-04')
    expect(iso(parseDateQuery('yesterday', TODAY))).toBe('2026-10-02')
    expect(iso(parseDateQuery('今天', TODAY))).toBe('2026-10-03')
    expect(iso(parseDateQuery('明天', TODAY))).toBe('2026-10-04')
    expect(iso(parseDateQuery('昨天', TODAY))).toBe('2026-10-02')
  })

  it('rolls relative days across a month boundary instead of clamping', () => {
    const lastOfMonth = new Date(2026, 9, 31)
    expect(iso(parseDateQuery('tomorrow', lastOfMonth))).toBe('2026-11-01')
  })

  it('reads an unambiguous ISO date', () => {
    expect(iso(parseDateQuery('2026-10-05', TODAY))).toBe('2026-10-05')
    expect(iso(parseDateQuery('2026-1-5', TODAY))).toBe('2026-01-05')
  })

  it('reads the Chinese forms, with or without the trailing characters', () => {
    expect(iso(parseDateQuery('2026年10月5日', TODAY))).toBe('2026-10-05')
    expect(iso(parseDateQuery('2026年10月5', TODAY))).toBe('2026-10-05')
    // Bare month-day lands in the year the palette is looking at.
    expect(iso(parseDateQuery('10月5日', TODAY))).toBe('2026-10-05')
    expect(iso(parseDateQuery('1月1日', TODAY))).toBe('2026-01-01')
  })

  it('reads a slashed date in each order it can mean', () => {
    expect(iso(parseDateQuery('2026/10/5', TODAY))).toBe('2026-10-05')
    // Middle number can only be a month, so the first one is the day.
    expect(iso(parseDateQuery('25/10/2026', TODAY))).toBe('2026-10-25')
    // A trailing 4-digit number is a year, and then the order is D/M/Y: a
    // calendar that guessed M/D/Y here would be wrong half the world over.
    expect(iso(parseDateQuery('10/5/2026', TODAY))).toBe('2026-05-10')
    // No year at all: month first, which is the only reading of a bare 10/5
    // that is not impossible.
    expect(iso(parseDateQuery('10/5', TODAY))).toBe('2026-10-05')
    expect(iso(parseDateQuery('13/10', TODAY))).toBe('2026-10-13')
    expect(iso(parseDateQuery('5.10.2026', TODAY))).toBe('2026-10-05')
    expect(iso(parseDateQuery('25.10.2026', TODAY))).toBe('2026-10-25')
  })

  it('tolerates spaces around the separators', () => {
    expect(iso(parseDateQuery('2026 / 10 / 5', TODAY))).toBe('2026-10-05')
  })

  it('returns null for a date that does not exist rather than rolling it over', () => {
    // `new Date(2026, 1, 31)` is 3 March; navigating there would be worse than
    // offering no item at all.
    expect(parseDateQuery('2026-02-31', TODAY)).toBeNull()
    expect(parseDateQuery('2026-13-01', TODAY)).toBeNull()
    expect(parseDateQuery('2026-00-10', TODAY)).toBeNull()
    expect(parseDateQuery('2026-10-00', TODAY)).toBeNull()
    expect(parseDateQuery('10/32', TODAY)).toBeNull()
  })

  it('returns null for free text, so a question falls through to search', () => {
    expect(parseDateQuery('next time I see Alex', TODAY)).toBeNull()
    expect(parseDateQuery('去年和 Alex 讨论项目的会议', TODAY)).toBeNull()
    expect(parseDateQuery('meeting about the budget', TODAY)).toBeNull()
    expect(parseDateQuery('someday', TODAY)).toBeNull()
    expect(parseDateQuery('', TODAY)).toBeNull()
    expect(parseDateQuery('   ', TODAY)).toBeNull()
    // A number with words attached is not a date either.
    expect(parseDateQuery('10/5 with Alex', TODAY)).toBeNull()
  })

  it('gives up on anything longer than a date could be', () => {
    expect(parseDateQuery('today '.repeat(6), TODAY)).toBeNull()
  })
})
