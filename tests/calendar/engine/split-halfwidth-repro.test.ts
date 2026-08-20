import { describe, expect, it } from 'vitest'
import {
  expandSeriesView,
  withUntil,
  type SeriesViewInput,
} from '@/lib/recurrence/engine'
import { planInstanceChange } from '@/lib/event-service'

/**
 * Repro: daily series starting Mon 9:00. Drag Wednesday's instance onto
 * Tuesday 14:00, scope "this and following". Bug report: from Tuesday on,
 * events render half-width (layout sees an overlapping pair) and it persists
 * after refresh — so check the SERVER-side resulting rows for same-day
 * overlaps.
 */

const DAY = 24 * 3600 * 1000
const d = (iso: string) => new Date(iso)

function masterA(): SeriesViewInput {
  return {
    id: 'A',
    title: 'Daily sync',
    description: null,
    location: null,
    startDate: d('2026-08-17T09:00:00.000Z'), // Monday
    endDate: d('2026-08-17T10:00:00.000Z'),
    isAllDay: false,
    color: null,
    categoryId: null,
    participants: null,
    notificationMinutes: null,
    rrule: 'RRULE:FREQ=DAILY;INTERVAL=1',
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    userId: 'u1',
    createdAt: d('2026-08-01T00:00:00.000Z'),
    updatedAt: d('2026-08-01T00:00:00.000Z'),
  } as unknown as SeriesViewInput
}

describe('split half-width repro (server-side data)', () => {
  it('dump per-day events after dragging Wed -> Tue 14:00 with following', () => {
    const master = masterA()
    const plan = planInstanceChange({
      master: master as never,
      override: null,
      overrides: [],
      recurrenceId: '20260819T090000Z', // Wednesday 09:00
      applyTo: 'following',
      fields: {
        title: 'Daily sync',
        startDate: d('2026-08-18T14:00:00.000Z'), // Tuesday 14:00 drop
        endDate: d('2026-08-18T15:00:00.000Z'),
      },
      now: d('2026-08-17T00:00:00.000Z'),
      timeZone: 'UTC',
    } as never)

    expect(plan.split).not.toBeNull()
    const split = plan.split!

    // applySplitPlan equivalent: truncate A, insert B.
    const aprime = {
      ...master,
      rrule: withUntil(master.rrule!, split.masterUntil),
      exdate: split.masterExdate,
    }
    const b = {
      ...master,
      ...split.newSeries.fields,
      id: 'B',
      rrule: split.newSeries.rrule,
      exdate: split.newSeries.exdate,
      seriesId: null,
      recurrenceId: null,
      startDate: split.newSeries.startDate,
      endDate: split.newSeries.endDate,
    } as unknown as SeriesViewInput

    console.log('A prime rrule:', aprime.rrule)
    console.log('A prime exdate:', aprime.exdate)
    console.log('B rrule:', b.rrule)
    console.log('B exdate:', b.exdate)
    console.log('B startDate:', b.startDate, 'endDate:', b.endDate)

    const view = expandSeriesView(
      [aprime as SeriesViewInput, b],
      [],
      d('2026-08-16T00:00:00.000Z'),
      d('2026-08-24T00:00:00.000Z'),
      1000,
      'UTC',
    ) as unknown as Array<{
      id: string
      seriesId: string
      recurrenceId: string
      startDate: Date
      endDate: Date
    }>

    const byDay = new Map<string, typeof view>()
    for (const e of view) {
      const day = e.startDate.toISOString().slice(0, 10)
      const list = byDay.get(day) ?? []
      list.push(e)
      byDay.set(day, list)
    }
    for (const [day, events] of [...byDay.entries()].sort()) {
      console.log(
        day,
        events
          .map(
            (e) =>
              `${e.seriesId}@${e.startDate.toISOString().slice(11, 16)}-${e.endDate.toISOString().slice(11, 16)}`,
          )
          .join('  '),
      )
    }

    // No day may contain two overlapping events.
    for (const [day, events] of byDay) {
      for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
          const a = events[i]
          const c = events[j]
          const overlap =
            a.startDate.getTime() < c.endDate.getTime() &&
            c.startDate.getTime() < a.endDate.getTime()
          if (overlap) {
            console.log(`OVERLAP on ${day}: ${a.id} vs ${c.id}`)
          }
          expect(overlap).toBe(false)
        }
      }
    }
  })
})
