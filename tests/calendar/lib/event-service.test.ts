import { describe, it, expect } from 'vitest'
import {
  expandRows,
  firstStampOfSeries,
  planInstanceChange,
  resolveInstance,
  type EventRow,
} from '@/lib/event-service'
import { parseRfcStamp } from '@/lib/recurrence/engine'

function day(y: number, m: number, d: number, h = 0, min = 0, s = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min, s))
}

let sequence = 0
function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
  sequence += 1
  const id = overrides.id ?? `evt-${sequence}`
  return {
    id,
    userId: 'u1',
    title: 'Team sync',
    description: null,
    location: null,
    startDate: day(2024, 1, 1),
    endDate: day(2024, 1, 1, 1),
    isAllDay: false,
    status: 'confirmed',
    color: null,
    categoryId: null,
    participants: null,
    notificationMinutes: null,
    createdAt: day(2023, 12, 1),
    updatedAt: day(2023, 12, 1),
    rrule: null,
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    ...overrides,
  }
}

function makeDailySeries(overrides: Partial<EventRow> = {}): EventRow {
  return makeEvent({
    rrule: 'FREQ=DAILY;INTERVAL=1',
    ...overrides,
  })
}

describe('firstStampOfSeries', () => {
  it('stamps timed events with UTC datetime', () => {
    const master = makeDailySeries({
      startDate: day(2024, 3, 5, 12, 30),
      isAllDay: false,
    })
    expect(firstStampOfSeries(master)).toBe('20240305T123000Z')
  })

  it('stamps all-day events with a date only', () => {
    const master = makeDailySeries({
      startDate: day(2024, 3, 5),
      isAllDay: true,
    })
    expect(firstStampOfSeries(master)).toBe('20240305')
  })
})

describe('expandRows', () => {
  it('passes plain events through unchanged with own instanceId', () => {
    const plain = makeEvent({ title: 'Alone' })
    const [result] = expandRows([plain])
    expect(result.id).toBe(plain.id)
    expect(result.title).toBe('Alone')
    expect(result.instanceId).toBe(plain.id)
    expect(result.recurrenceId).toBeNull()
  })

  it('expands a series within the given window (inclusive bounds)', () => {
    const master = makeDailySeries({
      startDate: day(2024, 1, 1),
      endDate: day(2024, 1, 1, 1),
    })
    const results = expandRows([master], {
      windowStart: day(2024, 1, 2),
      windowEnd: day(2024, 1, 4),
    })
    expect(results).toHaveLength(3)
    expect(results[0].startDate.getTime()).toBe(day(2024, 1, 2).getTime())
    expect(results[0].endDate.getTime()).toBe(day(2024, 1, 2, 1).getTime())
    expect(results[2].startDate.getTime()).toBe(day(2024, 1, 4).getTime())
  })

  it('applies an override at its recurrenceId', () => {
    const master = makeDailySeries({
      startDate: day(2024, 1, 1),
      endDate: day(2024, 1, 1, 1),
    })
    const override = makeEvent({
      id: 'ovr-1',
      seriesId: master.id,
      recurrenceId: '20240103T000000Z',
      title: 'Moved sync',
      startDate: day(2024, 1, 3, 9),
      endDate: day(2024, 1, 3, 10),
    })
    const results = expandRows([master, override], {
      windowStart: day(2024, 1, 1),
      windowEnd: day(2024, 1, 5),
    })
    const moved = results.find((e) => e.recurrenceId === '20240103T000000Z')
    expect(moved).toBeDefined()
    expect(moved!.title).toBe('Moved sync')
    expect(moved!.startDate.getTime()).toBe(day(2024, 1, 3, 9).getTime())
    const untouched = results.find((e) => e.recurrenceId === '20240102T000000Z')
    expect(untouched!.title).toBe('Team sync')
  })

  it('does not emit instances excluded by exdate', () => {
    const master = makeDailySeries({
      startDate: day(2024, 1, 1),
      endDate: day(2024, 1, 1, 1),
      exdate: ['20240102T000000Z'],
    })
    const results = expandRows([master], {
      windowStart: day(2024, 1, 1),
      windowEnd: day(2024, 1, 3),
    })
    expect(results.map((e) => e.recurrenceId)).toEqual([
      '20240101T000000Z',
      '20240103T000000Z',
    ])
  })

  it('emits the base instance again when an override is present without exdate (why DELETE must also exdate)', () => {
    const master = makeDailySeries({
      startDate: day(2024, 1, 1),
      endDate: day(2024, 1, 1, 1),
    })
    const override = makeEvent({
      id: 'ovr',
      seriesId: master.id,
      recurrenceId: '20240102T000000Z',
      title: 'Edited instance',
      startDate: day(2024, 1, 2, 15),
      endDate: day(2024, 1, 2, 16),
    })
    const results = expandRows([master, override], {
      windowStart: day(2024, 1, 1),
      windowEnd: day(2024, 1, 3),
    })
    expect(results.some((e) => e.recurrenceId === '20240102T000000Z')).toBe(
      true,
    )
  })

  it('exdate suppresses an occurrence even when an override row still exists (post-delete state)', () => {
    const master = makeDailySeries({
      startDate: day(2024, 1, 1),
      endDate: day(2024, 1, 1, 1),
      exdate: ['20240102T000000Z'],
    })
    const override = makeEvent({
      id: 'ovr',
      seriesId: master.id,
      recurrenceId: '20240102T000000Z',
      title: 'Edited instance',
      startDate: day(2024, 1, 2, 15),
      endDate: day(2024, 1, 2, 16),
    })
    const results = expandRows([master, override], {
      windowStart: day(2024, 1, 1),
      windowEnd: day(2024, 1, 3),
    })
    expect(results.some((e) => e.recurrenceId === '20240102T000000Z')).toBe(
      false,
    )
  })

  it('passes through a stranded override whose master is missing (route nulls seriesId first)', () => {
    const master = makeDailySeries({
      startDate: day(2023, 12, 25),
      endDate: day(2023, 12, 25, 1),
    })
    const override = makeEvent({
      id: 'ovr-2',
      seriesId: master.id,
      recurrenceId: '20240106T000000Z',
      title: 'Rescheduled',
      startDate: day(2024, 1, 6, 15),
      endDate: day(2024, 1, 6, 16),
    })
    const results = expandRows([{ ...override, seriesId: null }], {
      windowStart: day(2024, 1, 1),
      windowEnd: day(2024, 1, 8),
    })
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('ovr-2')
    expect(results[0].title).toBe('Rescheduled')
  })

  it('handles overrides supplied via opts.overrides', () => {
    const master = makeDailySeries({
      startDate: day(2024, 1, 1),
      endDate: day(2024, 1, 1, 1),
    })
    const override = makeEvent({
      id: 'ovr-3',
      seriesId: master.id,
      recurrenceId: '20240102T000000Z',
      title: 'Extra sync',
    })
    const results = expandRows([master], {
      windowStart: day(2024, 1, 1),
      windowEnd: day(2024, 1, 3),
      overrides: { [master.id]: [override] },
    })
    expect(
      results.find((e) => e.recurrenceId === '20240102T000000Z')!.title,
    ).toBe('Extra sync')
  })
})

describe('resolveInstance', () => {
  const master = makeDailySeries({
    startDate: day(2024, 1, 1, 10),
    endDate: day(2024, 1, 1, 11),
  })

  it('resolves a plain occurrence with master duration', () => {
    const resolved = resolveInstance(master, '20240105T100000Z')
    expect(resolved!.startDate.getTime()).toBe(day(2024, 1, 5, 10).getTime())
    expect(resolved!.endDate.getTime()).toBe(day(2024, 1, 5, 11).getTime())
    expect(resolved!.seriesId).toBe(master.id)
  })

  it('returns null when the occurrence is exdated and has no override', () => {
    const excluded = { ...master, exdate: ['20240105T100000Z'] }
    expect(resolveInstance(excluded, '20240105T100000Z')).toBeNull()
  })

  it('lets an override beat the exdate', () => {
    const excluded = { ...master, exdate: ['20240105T100000Z'] }
    const override = makeEvent({
      id: 'ovr-4',
      seriesId: master.id,
      recurrenceId: '20240105T100000Z',
      title: 'Restored',
    })
    const resolved = resolveInstance(excluded, '20240105T100000Z', [override])
    expect(resolved!.title).toBe('Restored')
  })

  it('surfaces override dates', () => {
    const override = makeEvent({
      id: 'ovr-5',
      seriesId: master.id,
      recurrenceId: '20240105T100000Z',
      startDate: day(2024, 1, 7, 14),
      endDate: day(2024, 1, 7, 15),
    })
    const resolved = resolveInstance(master, '20240105T100000Z', [override])
    expect(resolved!.startDate.getTime()).toBe(day(2024, 1, 7, 14).getTime())
  })

  it('returns null when a stamp does not parse', () => {
    expect(resolveInstance(master, 'not-a-stamp')).toBeNull()
  })
})

describe('planInstanceChange', () => {
  const master = makeDailySeries({
    startDate: day(2024, 1, 1, 10),
    endDate: day(2024, 1, 1, 11),
  })

  it("ignores single/following for applyTo 'all'", () => {
    const plan = planInstanceChange({
      master,
      override: null,
      recurrenceId: '20240105T100000Z',
      applyTo: 'all',
    })
    expect(plan.exdateToAdd).toBeNull()
    expect(plan.overrideUpsert).toBeNull()
    expect(plan.split).toBeNull()
  })

  it('plans a fresh single edit as exdate plus new override', () => {
    const plan = planInstanceChange({
      master,
      override: null,
      recurrenceId: '20240105T100000Z',
      applyTo: 'single',
      fields: { title: 'Edited sync' },
      now: day(2024, 1, 1),
    })
    expect(plan.exdateToAdd).toBe('20240105T100000Z')
    const upsert = plan.overrideUpsert!
    expect(upsert.isNew).toBe(true)
    expect(upsert.seriesId).toBe(master.id)
    expect(upsert.recurrenceId).toBe('20240105T100000Z')
    expect(upsert.fields.title).toBe('Edited sync')
    expect(upsert.fields.startDate).toBeUndefined()
  })

  it('does not re-add the exdate when it is already present', () => {
    const plan = planInstanceChange({
      master: { ...master, exdate: ['20240105T100000Z'] },
      override: null,
      recurrenceId: '20240105T100000Z',
      applyTo: 'single',
      fields: { title: 'Edited sync' },
    })
    expect(plan.exdateToAdd).toBeNull()
  })

  it('merges fields into an existing override instead of creating one', () => {
    const override = makeEvent({
      id: 'ovr-6',
      seriesId: master.id,
      recurrenceId: '20240105T100000Z',
      title: 'Existing',
    })
    const plan = planInstanceChange({
      master,
      override,
      recurrenceId: '20240105T100000Z',
      applyTo: 'single',
      fields: { location: 'Room 3' },
      now: day(2024, 1, 1),
    })
    const upsert = plan.overrideUpsert!
    expect(upsert.isNew).toBe(false)
    expect(upsert.id).toBe('ovr-6')
    expect(upsert.fields.title).toBe('Existing')
    expect(upsert.fields.location).toBe('Room 3')
  })

  it('plans a following split with UNTIL at the target stamp', () => {
    const plan = planInstanceChange({
      master,
      override: null,
      overrides: [],
      recurrenceId: '20240105T100000Z',
      applyTo: 'following',
      fields: { title: 'From now on' },
      now: day(2024, 1, 1),
    })
    const split = plan.split!
    expect(plan.deleteOverrideId).toBeNull()
    expect(split.masterUntil).toBe('20240105T100000Z')
    expect(split.masterExdate).toContain('20240105T100000Z')
    expect(split.newSeries.id).not.toBe(master.id)
    expect(split.newSeries.rrule).toMatch(/^FREQ=DAILY/)
    expect(split.newSeries.startDate.getTime()).toBe(
      day(2024, 1, 5, 10).getTime(),
    )
    expect(split.newSeries.endDate.getTime()).toBe(
      day(2024, 1, 5, 11).getTime(),
    )
    expect(split.newSeries.fields.title).toBe('From now on')
    expect(split.moveOverrideIds).toEqual([])
  })

  it('feeds override start/end dates into the split', () => {
    const override = makeEvent({
      id: 'ovr-7',
      seriesId: master.id,
      recurrenceId: '20240105T100000Z',
      title: 'Moving day',
      startDate: day(2024, 1, 6, 9),
      endDate: day(2024, 1, 6, 10),
    })
    const plan = planInstanceChange({
      master,
      override,
      overrides: [override],
      recurrenceId: '20240105T100000Z',
      applyTo: 'following',
      fields: {},
      now: day(2024, 1, 1),
    })
    const split = plan.split!
    expect(plan.deleteOverrideId).toBe('ovr-7')
    expect(split.newSeries.startDate.getTime()).toBe(
      day(2024, 1, 6, 9).getTime(),
    )
    expect(split.newSeries.rrule.startsWith('FREQ=DAILY')).toBe(true)
  })

  it('moves future overrides to the new series only', () => {
    const pastOvr = makeEvent({
      id: 'ovr-8',
      seriesId: master.id,
      recurrenceId: '20240102T100000Z',
    })
    const futureOvr = makeEvent({
      id: 'ovr-9',
      seriesId: master.id,
      recurrenceId: '20240107T100000Z',
    })
    const plan = planInstanceChange({
      master,
      override: null,
      overrides: [pastOvr, futureOvr],
      recurrenceId: '20240105T100000Z',
      applyTo: 'following',
      fields: {},
      now: day(2024, 1, 1),
    })
    expect(plan.split!.moveOverrideIds).toEqual(['ovr-9'])
  })

  it('keeps past exdates on the master, moves future ones to the new series', () => {
    const plan = planInstanceChange({
      master: {
        ...master,
        exdate: ['20240103T100000Z', '20240107T100000Z'],
      },
      override: null,
      overrides: [],
      recurrenceId: '20240105T100000Z',
      applyTo: 'following',
      fields: {},
      now: day(2024, 1, 1),
    })
    const split = plan.split!
    expect(split.masterExdate).toEqual(['20240103T100000Z', '20240105T100000Z'])
    expect(split.newSeries.exdate).toEqual(['20240107T100000Z'])
  })

  it('reanchors the new series rrule to the split point', () => {
    const weekly = makeDailySeries({
      startDate: day(2024, 1, 1, 10),
      endDate: day(2024, 1, 1, 11),
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    })
    const plan = planInstanceChange({
      master: weekly,
      override: null,
      overrides: [],
      recurrenceId: '20240108T100000Z',
      applyTo: 'following',
      fields: {},
      now: day(2024, 1, 1),
    })
    const { date } = parseRfcStamp(plan.split!.masterUntil)
    expect(date.getTime()).toBe(day(2024, 1, 8, 10).getTime())
    expect(plan.split!.newSeries.rrule).toContain('BYDAY=MO')
  })
})
