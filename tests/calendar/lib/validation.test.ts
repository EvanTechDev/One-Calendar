import { describe, it, expect } from 'vitest'
import {
  eventSchema,
  categorySchema,
  countdownSchema,
  importSchema,
  firstZodMessage,
  invitePatchSchema,
  RSVP_STATUSES,
} from '@/lib/validation'

function validEvent() {
  return {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    title: 'Standup',
    description: null,
    location: 'Room 1',
    startDate: '2026-08-13T09:00:00.000Z',
    endDate: '2026-08-13T09:30:00.000Z',
    isAllDay: false,
    color: 'bg-[#E6F6FD]',
    categoryId: null,
    participants: [{ name: 'alice@example.com' }],
    notificationMinutes: 15,
  }
}

describe('eventSchema', () => {
  it('accepts a valid payload', () => {
    expect(eventSchema.safeParse(validEvent()).success).toBe(true)
  })

  it('accepts the client color formats (tailwind class, arbitrary value, hex)', () => {
    for (const color of [
      'bg-blue-500',
      'bg-indigo-500',
      'bg-orange-500',
      'bg-[#E6F6FD]',
      '#3B82F6',
      null,
      undefined,
    ]) {
      expect(eventSchema.safeParse({ ...validEvent(), color }).success).toBe(
        true,
      )
    }
  })

  it('rejects a payload without a title', () => {
    const { title: _title, ...rest } = validEvent()
    expect(eventSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a title longer than 200 chars', () => {
    expect(
      eventSchema.safeParse({
        ...validEvent(),
        title: 'x'.repeat(201),
      }).success,
    ).toBe(false)
  })

  it('rejects a malformed date', () => {
    expect(
      eventSchema.safeParse({ ...validEvent(), startDate: 'not-a-date' })
        .success,
    ).toBe(false)
  })

  it('rejects a date-only startDate (events need a full datetime)', () => {
    expect(
      eventSchema.safeParse({ ...validEvent(), startDate: '2026-08-13' })
        .success,
    ).toBe(false)
  })

  it('rejects more than 50 participants', () => {
    expect(
      eventSchema.safeParse({
        ...validEvent(),
        participants: Array.from({ length: 51 }, (_, i) => ({
          name: `person${i}@example.com`,
        })),
      }).success,
    ).toBe(false)
  })

  it('rejects an invalid color', () => {
    expect(
      eventSchema.safeParse({ ...validEvent(), color: 'red' }).success,
    ).toBe(false)
    expect(
      eventSchema.safeParse({ ...validEvent(), color: 'bg-red-400' }).success,
    ).toBe(false)
    expect(
      eventSchema.safeParse({ ...validEvent(), color: 'bg-[red]' }).success,
    ).toBe(false)
  })
})

describe('importSchema', () => {
  it('rejects more than 500 events', () => {
    expect(
      importSchema.safeParse({
        events: Array.from({ length: 501 }, validEvent),
      }).success,
    ).toBe(false)
  })

  it('rejects more than 200 categories', () => {
    const categories = Array.from({ length: 201 }, () => ({
      name: 'Cat',
      color: 'bg-blue-500',
    }))
    expect(importSchema.safeParse({ categories }).success).toBe(false)
  })

  it('rejects more than 200 countdowns', () => {
    const countdowns = Array.from({ length: 201 }, () => ({
      name: 'Cdown',
      targetDate: '2026-08-13',
      color: 'bg-green-500',
    }))
    expect(importSchema.safeParse({ countdowns }).success).toBe(false)
  })
})

describe('categorySchema', () => {
  it('accepts a palette class color', () => {
    expect(
      categorySchema.safeParse({ name: 'Work', color: 'bg-blue-500' }).success,
    ).toBe(true)
  })

  it('rejects a non-hex / non-class color', () => {
    expect(
      categorySchema.safeParse({ name: 'Work', color: 'garbage' }).success,
    ).toBe(false)
    expect(
      categorySchema.safeParse({ name: 'Work', color: 'rgb(1,2,3)' }).success,
    ).toBe(false)
  })
})

describe('countdownSchema', () => {
  it('accepts a date-only targetDate (what the client posts)', () => {
    expect(
      countdownSchema.safeParse({
        name: 'Launch',
        targetDate: '2026-08-13',
      }).success,
    ).toBe(true)
  })

  it('accepts a Date.now()-style id (what the client posts)', () => {
    expect(
      countdownSchema.safeParse({
        id: '1723545600000',
        name: 'Launch',
        targetDate: '2026-08-13',
      }).success,
    ).toBe(true)
  })
})

describe('invitePatchSchema', () => {
  it('accepts each valid status', () => {
    for (const status of RSVP_STATUSES) {
      expect(invitePatchSchema.safeParse({ status }).success).toBe(true)
    }
  })

  it('rejects an unknown status', () => {
    expect(invitePatchSchema.safeParse({ status: 'attending' }).success).toBe(
      false,
    )
    expect(invitePatchSchema.safeParse({ status: '' }).success).toBe(false)
    expect(invitePatchSchema.safeParse({ status: null }).success).toBe(false)
  })

  it('accepts a categoryId alone', () => {
    expect(invitePatchSchema.safeParse({ categoryId: 'abc' }).success).toBe(
      true,
    )
  })

  it('accepts both fields together', () => {
    expect(
      invitePatchSchema.safeParse({ status: 'accepted', categoryId: 'abc' })
        .success,
    ).toBe(true)
  })

  it('rejects an empty body with a helpful message', () => {
    const result = invitePatchSchema.safeParse({})
    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected parse failure')
    expect(firstZodMessage(result.error)).toBe('Provide status or categoryId')
  })

  it('rejects null (the malformed-body sentinel)', () => {
    expect(invitePatchSchema.safeParse(null).success).toBe(false)
  })

  it('rejects an over-long categoryId', () => {
    expect(
      invitePatchSchema.safeParse({ categoryId: 'a'.repeat(101) }).success,
    ).toBe(false)
  })
})

describe('RSVP_STATUSES', () => {
  it('has exactly the four expected members', () => {
    expect([...RSVP_STATUSES]).toEqual([
      'pending',
      'accepted',
      'maybe',
      'declined',
    ])
  })
})

describe('firstZodMessage', () => {
  it('returns the first issue message', () => {
    const result = eventSchema.safeParse({ startDate: 'bad' })
    if (result.success) throw new Error('expected parse failure')
    const message = firstZodMessage(result.error)
    expect(typeof message).toBe('string')
    expect(message.length).toBeGreaterThan(0)
  })
})
