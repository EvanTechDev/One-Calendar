import { describe, it, expect } from 'vitest'
import { firstName, greetingFor, nextUpcoming } from '@/lib/home-summary'

const at = (iso: string) => new Date(iso)

describe('greetingFor', () => {
  it('bands the day the way the calendar does', () => {
    expect(greetingFor(at('2026-08-25T08:00:00'))).toBe('Good morning')
    expect(greetingFor(at('2026-08-25T13:00:00'))).toBe('Good afternoon')
    expect(greetingFor(at('2026-08-25T19:00:00'))).toBe('Good evening')
  })

  it('does not tell a 02:00 user good morning', () => {
    expect(greetingFor(at('2026-08-25T02:00:00'))).toBe('Good night')
  })

  it('rolls over to morning at 05:00 and afternoon at noon', () => {
    expect(greetingFor(at('2026-08-25T04:59:00'))).toBe('Good night')
    expect(greetingFor(at('2026-08-25T05:00:00'))).toBe('Good morning')
    expect(greetingFor(at('2026-08-25T11:59:00'))).toBe('Good morning')
    expect(greetingFor(at('2026-08-25T12:00:00'))).toBe('Good afternoon')
    expect(greetingFor(at('2026-08-25T18:00:00'))).toBe('Good evening')
  })
})

describe('firstName', () => {
  it('takes the leading word', () => {
    expect(firstName('Ada Lovelace')).toBe('Ada')
  })

  it('handles a single name and stray whitespace', () => {
    expect(firstName('  Grace  ')).toBe('Grace')
  })

  it('is empty rather than undefined when there is no name', () => {
    expect(firstName(undefined)).toBe('')
    expect(firstName(null)).toBe('')
    expect(firstName('   ')).toBe('')
  })
})

describe('nextUpcoming', () => {
  const rows = [
    {
      id: 'later',
      startDate: '2026-08-25T15:00:00Z',
      endDate: '2026-08-25T16:00:00Z',
    },
    {
      id: 'soon',
      startDate: '2026-08-25T11:00:00Z',
      endDate: '2026-08-25T12:00:00Z',
    },
    {
      id: 'past',
      startDate: '2026-08-25T08:00:00Z',
      endDate: '2026-08-25T09:00:00Z',
    },
  ]

  it('picks the earliest meeting that has not finished', () => {
    expect(nextUpcoming(rows, at('2026-08-25T10:00:00Z'))?.id).toBe('soon')
  })

  // The list arrives from the calendar app; trusting its order would mean
  // home showing a join time that is not the next one.
  it('re-sorts rather than trusting the given order', () => {
    const shuffled = [rows[0]!, rows[1]!]
    expect(nextUpcoming(shuffled, at('2026-08-25T10:00:00Z'))?.id).toBe('soon')
  })

  it('prefers a meeting already under way over one starting later', () => {
    expect(nextUpcoming(rows, at('2026-08-25T11:30:00Z'))?.id).toBe('soon')
  })

  it('skips a meeting that has finished', () => {
    expect(nextUpcoming(rows, at('2026-08-25T12:30:00Z'))?.id).toBe('later')
  })

  it('is null when everything has finished', () => {
    expect(nextUpcoming(rows, at('2026-08-26T00:00:00Z'))).toBeNull()
  })

  it('is null for an empty list', () => {
    expect(nextUpcoming([], at('2026-08-25T10:00:00Z'))).toBeNull()
  })

  it('ignores a row with an unparseable date rather than ranking it first', () => {
    const broken = [
      { id: 'broken', startDate: 'nope', endDate: 'nope' },
      rows[1]!,
    ]
    expect(nextUpcoming(broken, at('2026-08-25T10:00:00Z'))?.id).toBe('soon')
  })
})
