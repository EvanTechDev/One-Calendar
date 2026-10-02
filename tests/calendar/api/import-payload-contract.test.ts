import { describe, expect, it } from 'vitest'
import { importSchema } from '@/lib/validation'

/**
 * The `/api/import` request body, exactly as `import-export.tsx` builds it.
 *
 * The client maps each normalised event to these fifteen keys and nothing else.
 * If any one of them is refused, `importSchema.safeParse` rejects the WHOLE
 * body — and because the client derives its success toast from the events it
 * parsed locally rather than from the server's reply, a rejected body can look
 * like a partial success. So this file pins the contract from the client's
 * side rather than from the schema's.
 */
function payloadEvent(over: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    title: 'Standup',
    startDate: '2026-10-01T09:00:00.000Z',
    endDate: '2026-10-01T09:15:00.000Z',
    isAllDay: false,
    description: null,
    location: null,
    rrule: null,
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    participants: null,
    notificationMinutes: null,
    color: null,
    categoryId: null,
    ...over,
  }
}

describe('import payload contract', () => {
  it('accepts the plain non-recurring event the client sends', () => {
    const r = importSchema.safeParse({ events: [payloadEvent()] })
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(
      true,
    )
  })

  it('accepts an event whose optional fields are all null', () => {
    // `normalizeImportedEvent` fills every field, and the mapper writes
    // `?? null` for the ones it has nothing for, so a restore sends a full row
    // of nulls rather than omitting them.
    const r = importSchema.safeParse({ events: [payloadEvent()] })
    expect(r.success).toBe(true)
  })

  it('accepts a recurring master with an RFC-stamped exdate', () => {
    const r = importSchema.safeParse({
      events: [
        payloadEvent({
          rrule: 'FREQ=WEEKLY;COUNT=10',
          exdate: ['20261008T090000Z', '20261015T090000Z'],
        }),
      ],
    })
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(
      true,
    )
  })

  it('accepts a single-instance edit of a series', () => {
    const r = importSchema.safeParse({
      events: [
        payloadEvent({ seriesId: 'evt-1', recurrenceId: '20261008T090000Z' }),
      ],
    })
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(
      true,
    )
  })

  it('accepts a palette colour as well as an arbitrary one', () => {
    for (const color of ['bg-blue-500', 'bg-[#E6F6FD]', 'bg-[#EEF2FF]']) {
      const r = importSchema.safeParse({ events: [payloadEvent({ color })] })
      expect(r.success, `rejected ${color}`).toBe(true)
    }
  })

  it('accepts participants as objects and bare emails as names', () => {
    const r = importSchema.safeParse({
      events: [
        payloadEvent({
          participants: [
            { name: 'someone@example.com' },
            { name: 'Someone', email: 'someone@example.com' },
          ],
        }),
      ],
    })
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(
      true,
    )
  })

  it('rejects a participant entry with no name', () => {
    // The client maps a bare string to `{ name: p }`, but an object from a
    // hand-written or older backup may not carry one.
    const r = importSchema.safeParse({
      events: [payloadEvent({ participants: [{ email: 'a@b.com' }] })],
    })
    expect(r.success).toBe(false)
  })

  it('rejects an exdate that is not an RFC stamp, and says so', () => {
    const r = importSchema.safeParse({
      events: [payloadEvent({ exdate: ['2026-10-08T09:00:00.000Z'] })],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).toContain('RFC stamp')
    }
  })

  it('rejects a malformed rrule', () => {
    const r = importSchema.safeParse({
      events: [payloadEvent({ rrule: 'FREQ=NONSENSE' })],
    })
    expect(r.success).toBe(false)
  })

  it('accepts settings on their own', () => {
    const r = importSchema.safeParse({
      settings: { theme: 'dark', firstDayOfWeek: 1 },
    })
    expect(r.success).toBe(true)
  })
})
