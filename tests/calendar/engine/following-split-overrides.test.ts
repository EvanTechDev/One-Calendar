import { describe, expect, it } from 'vitest'
import {
  expandSeriesView,
  optimisticFollowingSplit,
  defaultExpansionWindow,
  shiftOverrideRow,
  toRfcStamp,
} from '@/lib/recurrence/engine'
import { planInstanceChange } from '@/lib/event-service'

interface StoreEvent {
  id: string
  title: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
  rrule: string | null
  exdate: string[] | null
  seriesId: string | null
  recurrenceId: string | null
  color: string
  calendarId: string
  isOverride?: boolean
}

const dailyRule = 'RRULE:FREQ=DAILY;INTERVAL=1'
const masterId = 'master-1'

function buildDailyStore(): StoreEvent[] {
  const out: StoreEvent[] = []
  for (let i = 0; i < 10; i++) {
    const d = new Date(Date.UTC(2026, 7, 10 + i, 10, 0, 0))
    const stamp = toRfcStamp(d, false)
    out.push({
      id: `${masterId}_${stamp}`,
      title: 'Daily',
      startDate: d,
      endDate: new Date(d.getTime() + 60 * 60 * 1000),
      isAllDay: false,
      rrule: dailyRule,
      exdate: null,
      seriesId: masterId,
      recurrenceId: stamp,
      color: '#3B82F6',
      calendarId: 'cal-1',
    })
  }
  const wed = out.find((e) => e.recurrenceId === '20260812T100000Z')!
  wed.startDate = new Date('2026-08-12T14:00:00.000Z')
  wed.endDate = new Date('2026-08-12T14:30:00.000Z')
  wed.isOverride = true
  return out
}

function baseEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: masterId,
    userId: 'u1',
    title: 'Daily',
    description: null,
    location: null,
    startDate: new Date('2026-08-10T10:00:00.000Z'),
    endDate: new Date('2026-08-10T11:00:00.000Z'),
    isAllDay: false,
    status: 'confirmed',
    color: null,
    categoryId: null,
    participants: [],
    notificationMinutes: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    rrule: dailyRule,
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    ...overrides,
  }
}

function viewSeries(
  masters: Record<string, unknown>[],
  overrides: Record<string, unknown>[],
  windowStart: Date,
  windowEnd: Date,
): StoreEvent[] {
  return expandSeriesView(
    masters as any,
    overrides as any,
    windowStart,
    windowEnd,
  ) as unknown as StoreEvent[]
}

/** Mirrors data-provider replaceSeriesInstances */
function replaceSeriesInstances(
  events: StoreEvent[],
  incoming: StoreEvent[],
): StoreEvent[] {
  const seriesIds = new Set<string>()
  const ids = new Set<string>()
  for (const e of incoming) {
    if (e.seriesId) seriesIds.add(e.seriesId)
    else ids.add(e.id)
  }
  const kept = events.filter(
    (e) => !(e.seriesId && seriesIds.has(e.seriesId)) && !ids.has(e.id),
  )
  return [...kept, ...incoming]
}

describe('following split keeps single-edited overrides (daily + edited Wednesday)', () => {
  it('drag Wednesday 14:00 -> Wednesday 16:00, This and following', () => {
    const window = defaultExpansionWindow()
    const store = buildDailyStore()
    const target = store.find((e) => e.recurrenceId === '20260812T100000Z')!

    // --- client optimistic split ---
    const updatedEvent: StoreEvent = {
      ...target,
      startDate: new Date('2026-08-12T16:00:00.000Z'),
      endDate: new Date('2026-08-12T16:30:00.000Z'),
    }
    const nextMaster: StoreEvent = {
      ...updatedEvent,
      id: 'new-series-uuid',
      seriesId: null,
      recurrenceId: null,
      rrule: updatedEvent.rrule ?? null,
    }
    const optimistic = optimisticFollowingSplit(
      store,
      target,
      nextMaster,
      window.windowStart,
      window.windowEnd,
    )!

    const dup = optimistic.filter(
      (e, i) => optimistic.findIndex((x) => x.id === e.id) !== i,
    )
    expect(dup).toEqual([])

    // --- server split ---
    const overrideRow = baseEventRow({
      id: 'override-wed',
      seriesId: masterId,
      recurrenceId: '20260812T100000Z',
      startDate: new Date('2026-08-12T14:00:00.000Z'),
      endDate: new Date('2026-08-12T14:30:00.000Z'),
      rrule: null,
    })
    const plan = planInstanceChange({
      master: baseEventRow() as any,
      override: overrideRow as any,
      overrides: [overrideRow] as any,
      recurrenceId: '20260812T100000Z',
      applyTo: 'following',
      fields: {
        startDate: new Date('2026-08-12T16:00:00.000Z'),
        endDate: new Date('2026-08-12T16:30:00.000Z'),
      } as any,
      now: new Date('2026-08-18T00:00:00Z'),
    })
    const oldMaster = {
      ...baseEventRow(),
      rrule: 'RRULE:FREQ=DAILY;INTERVAL=1;UNTIL=20260812T100000Z',
      exdate: ['20260812T100000Z'],
    }
    const newMaster = {
      ...baseEventRow(),
      id: 'new-series-uuid',
      startDate: new Date('2026-08-12T16:00:00.000Z'),
      endDate: new Date('2026-08-12T16:30:00.000Z'),
      rrule: plan.split!.newSeries.rrule,
      exdate: plan.split!.newSeries.exdate,
    }
    const serverView = viewSeries(
      [oldMaster, newMaster],
      [],
      window.windowStart,
      window.windowEnd,
    )
    // applySplitPlan deletes the old Wednesday override row
    const finalStore = replaceSeriesInstances(optimistic, serverView)

    const dayStr = (e: StoreEvent) =>
      `${e.startDate.toISOString().slice(0, 10)} ${e.startDate.toISOString().slice(11, 16)}`
    const before = store.map(dayStr)
    const after = finalStore.map(dayStr)
    console.log('BEFORE OPTIMISTIC:', before.slice(0, 12).join(' | '))
    console.log('AFTER ROUNDTRIP :', after.slice(0, 12).join(' | '))
    expect(finalStore.filter((e) => e.seriesId === masterId).length).toBe(2)
    const wedAt14 = finalStore.filter(
      (e) => e.startDate.toISOString() === '2026-08-12T14:00:00.000Z',
    )
    expect(wedAt14.length).toBe(0)
  })

  it('drag Monday -> Tuesday 09:00 with following (day shift, Wednesday override moves)', () => {
    const window = defaultExpansionWindow()
    const store = buildDailyStore()
    const target = store.find((e) => e.recurrenceId === '20260810T100000Z')!

    const updatedEvent: StoreEvent = {
      ...target,
      startDate: new Date('2026-08-11T09:00:00.000Z'),
      endDate: new Date('2026-08-11T10:00:00.000Z'),
    }
    const nextMaster: StoreEvent = {
      ...updatedEvent,
      id: 'new-series-uuid-2',
      seriesId: null,
      recurrenceId: null,
      rrule: updatedEvent.rrule ?? null,
    }
    const optimistic = optimisticFollowingSplit(
      store,
      target,
      nextMaster,
      window.windowStart,
      window.windowEnd,
    )!
    const optimisticDays = optimistic.map(
      (e) =>
        `${e.startDate.toISOString().slice(0, 10)} ${e.startDate.toISOString().slice(11, 16)}${e.isOverride ? '*' : ''}`,
    )
    console.log('OPTIMISTIC:', optimisticDays.slice(0, 8).join(' | '))

    const overrideRow = baseEventRow({
      id: 'override-wed',
      seriesId: masterId,
      recurrenceId: '20260812T100000Z',
      startDate: new Date('2026-08-12T14:00:00.000Z'),
      endDate: new Date('2026-08-12T14:30:00.000Z'),
      rrule: null,
    })
    const plan = planInstanceChange({
      master: baseEventRow() as any,
      override: null,
      overrides: [overrideRow] as any,
      recurrenceId: '20260810T100000Z',
      applyTo: 'following',
      fields: {
        startDate: new Date('2026-08-11T09:00:00.000Z'),
        endDate: new Date('2026-08-11T10:00:00.000Z'),
      } as any,
      now: new Date('2026-08-18T00:00:00Z'),
    })
    expect(plan.split!.moveOverrideIds).toEqual(['override-wed'])
    const deltaMs =
      new Date('2026-08-11T09:00:00.000Z').getTime() -
      new Date('2026-08-10T10:00:00.000Z').getTime()
    // route.shiftOverridesByDelta
    const shifted = shiftOverrideRow(
      overrideRow.recurrenceId!,
      overrideRow.startDate as Date,
      overrideRow.endDate as Date,
      deltaMs,
    )
    expect(shifted.recurrenceId).toBe('20260813T090000Z')
    const movedOverride = {
      ...overrideRow,
      seriesId: 'new-series-uuid-2',
      recurrenceId: shifted.recurrenceId,
      startDate: shifted.startDate,
      endDate: shifted.endDate,
    }
    const oldMaster = {
      ...baseEventRow(),
      rrule: 'RRULE:FREQ=DAILY;INTERVAL=1;UNTIL=20260810T100000Z',
      exdate: ['20260810T100000Z'],
    }
    const newMaster = {
      ...baseEventRow(),
      id: 'new-series-uuid-2',
      startDate: new Date('2026-08-11T09:00:00.000Z'),
      endDate: new Date('2026-08-11T10:00:00.000Z'),
      rrule: plan.split!.newSeries.rrule,
      exdate: plan.split!.newSeries.exdate,
    }
    const serverView = viewSeries(
      [oldMaster, newMaster],
      [movedOverride],
      window.windowStart,
      window.windowEnd,
    )
    const finalStore = replaceSeriesInstances(optimistic, serverView)

    const dayStr = (e: StoreEvent) =>
      `${e.startDate.toISOString().slice(0, 10)} ${e.startDate.toISOString().slice(11, 16)}${e.isOverride ? '*' : ''}`
    const after = finalStore.map(dayStr)
    console.log('AFTER ROUNDTRIP :', after.slice(0, 10).join(' | '))

    // no ghost on the old day (Wednesday), no duplicate ids
    expect(
      finalStore.some(
        (e) => e.startDate.toISOString() === '2026-08-12T14:00:00.000Z',
      ),
    ).toBe(false)
    const dup = finalStore.filter(
      (e, i) => finalStore.findIndex((x) => x.id === e.id) !== i,
    )
    expect(dup).toEqual([])

    // old series: the dragged Monday instance moved into the new series, so
    // the old series has no occurrences left in the window
    const oldSeries = finalStore.filter((e) => e.seriesId === masterId)
    expect(oldSeries).toEqual([])

    // new series: regenerated 09:00 occurrences, edited Wednesday instance
    // follows its series onto Thursday keeping its 14:00 time
    const newSeries = finalStore.filter(
      (e) => e.seriesId === 'new-series-uuid-2',
    )
    const newSeriesDayStr = newSeries.map(dayStr)
    expect(newSeriesDayStr.slice(0, 8)).toEqual([
      '2026-08-11 09:00',
      '2026-08-12 09:00',
      '2026-08-13 14:00*',
      '2026-08-14 09:00',
      '2026-08-15 09:00',
      '2026-08-16 09:00',
      '2026-08-17 09:00',
      '2026-08-18 09:00',
    ])
    const movedInstance = newSeries.find((e) => e.isOverride)
    expect(movedInstance?.recurrenceId).toBe('20260813T090000Z')
    expect(movedInstance?.startDate.toISOString()).toBe(
      '2026-08-13T14:00:00.000Z',
    )
  })
})
