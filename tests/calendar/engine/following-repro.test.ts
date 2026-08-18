import { describe, expect, it } from 'vitest'
import { RRule } from 'rrule'
import {
  adaptRuleToStart,
  expandSeriesView,
  optimisticFollowingSplit,
  parseRfcStamp,
  shiftToAnchorClock,
} from '@/lib/recurrence/engine'
import {
  planInstanceChange,
  type InstanceChangePlan,
} from '@/lib/event-service'

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
}

const weeklyRule = 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO'
const masterId = 'master-1'
const baseMaster = {
  id: masterId,
  title: 'Weekly sync',
  startDate: utcDate('2026-08-10T09:00:00Z'),
  endDate: utcDate('2026-08-10T10:00:00Z'),
  isAllDay: false,
  rrule: weeklyRule,
  exdate: null,
  seriesId: null,
  recurrenceId: null,
  color: '#3B82F6',
  calendarId: 'cal-1',
}

function utcDate(iso: string): Date {
  return new Date(iso)
}

function buildStore(): StoreEvent[] {
  const instances: StoreEvent[] = []
  for (let i = 0; i < 8; i++) {
    const d = new Date(Date.UTC(2026, 7, 10 + i * 7, 9, 0, 0))
    const stamp = d.toISOString()
    instances.push({
      id: `${masterId}_${stamp}`,
      title: 'Weekly sync',
      startDate: d,
      endDate: new Date(d.getTime() + 60 * 60 * 1000),
      isAllDay: false,
      rrule: weeklyRule,
      exdate: null,
      seriesId: masterId,
      recurrenceId: stamp,
      color: '#3B82F6',
      calendarId: 'cal-1',
    })
  }
  return [baseMaster, ...instances]
}

describe('regression: this-and-following save', () => {
  it('replays the client handleEventUpdate("following") flow without throwing', () => {
    const store = buildStore()
    const target = store[4]
    const updatedEvent: StoreEvent = {
      ...target,
      title: 'Renamed',
    }
    const windowStart = new Date(Date.now() - 2 * 365 * 24 * 3600 * 1000)
    const windowEnd = new Date(Date.now() + 2 * 365 * 24 * 3600 * 1000)

    const nextMaster: StoreEvent = {
      ...updatedEvent,
      id: 'uuid-1',
      seriesId: null,
      recurrenceId: null,
      rrule: updatedEvent.rrule ?? null,
    }

    const split = optimisticFollowingSplit(
      store,
      target,
      nextMaster,
      windowStart,
      windowEnd,
    )
    expect(split).not.toBeNull()
    const kept = split!.filter((e) => e.seriesId === masterId)
    const newSeries = split!.filter((e) => e.seriesId === 'uuid-1')
    expect(kept.length).toBeGreaterThan(0)
    expect(newSeries.length).toBeGreaterThan(0)
    expect(newSeries[0].title).toBe('Renamed')
    expect(kept.some((e) => e.title === 'Renamed')).toBe(false)
  })

  it('replays planInstanceChange("following") with realistic fields', () => {
    const master = {
      id: masterId,
      title: 'Weekly sync',
      startDate: utcDate('2026-08-10T09:00:00.000Z'),
      endDate: utcDate('2026-08-10T10:00:00.000Z'),
      isAllDay: false,
      rrule: weeklyRule,
      exdate: null,
      color: '#3B82F6',
      categoryId: null,
      description: null,
      location: null,
      participants: [],
      notificationMinutes: null,
      status: 'confirmed',
      createdAt: utcDate('2026-08-01T00:00:00.000Z'),
      updatedAt: utcDate('2026-08-01T00:00:00.000Z'),
      seriesId: null,
      recurrenceId: null,
      userId: 'user-1',
    }
    const targetStamp = '20260831T090000Z'
    const plan = planInstanceChange({
      master,
      override: null,
      overrides: [],
      recurrenceId: targetStamp,
      applyTo: 'following',
      fields: {
        title: 'Renamed',
        startDate: parseRfcStamp(targetStamp).date,
        endDate: parseRfcStamp(targetStamp).date,
      },
      now: utcDate('2026-08-18T00:00:00Z'),
    })
    expect(plan.split).not.toBeNull()
    expect(plan.split!.newSeries.rrule).toContain('FREQ=WEEKLY')
    expect((plan.split!.newSeries.fields as { title?: string }).title).toBe(
      'Renamed',
    )
  })

  it("keeps a series' anchor date when editing a mid-series occurrence with 'all'", () => {
    const rule = 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO'
    const prevStart = utcDate('2026-08-10T09:00:00Z')
    const editedInstance = utcDate('2026-08-31T11:00:00Z')

    const anchor = shiftToAnchorClock(prevStart, editedInstance)
    expect(anchor.toISOString()).toBe('2026-08-10T11:00:00.000Z')

    const adapted = adaptRuleToStart(rule, prevStart, anchor, false)
    const ruleWithDtstart = new RRule({
      ...RRule.fromString(adapted).origOptions,
      dtstart: anchor,
    })
    const occurrences = ruleWithDtstart.between(
      utcDate('2026-08-01T00:00:00Z'),
      utcDate('2026-08-15T00:00:00Z'),
      true,
    )
    expect(occurrences[0].toISOString()).toBe('2026-08-10T11:00:00.000Z')

    const badAnchor = editedInstance
    const badAdapted = adaptRuleToStart(rule, prevStart, badAnchor, false)
    const badOccurrences = new RRule({
      ...RRule.fromString(badAdapted).origOptions,
      dtstart: badAnchor,
    }).between(
      utcDate('2026-08-01T00:00:00Z'),
      utcDate('2026-08-15T00:00:00Z'),
      true,
    )
    expect(badOccurrences.length).toBe(0)
  })

  it('expands the whole store-shaped list without throwing', () => {
    const store = buildStore()
    const masters = store.filter((e) => e.seriesId === null)
    expect(masters.length).toBe(1)
    const m = masters[0]
    expect(m.calendarId).toBe('cal-1')
    const m2 = {
      ...m,
      startDate: new Date(m.startDate),
      endDate: new Date(m.endDate),
    }
    const parsed = RRule.fromString(m2.rrule!.trim())
    const rule = new RRule({
      ...parsed.origOptions,
      dtstart: new Date(Date.UTC(2026, 7, 10, 9, 0, 0)),
    })
    const occ = rule.between(
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2027, 0, 1)),
      true,
    )
    expect(occ.length).toBeGreaterThan(3)
    const expanded = expandSeriesView(
      masters,
      [],
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2027, 0, 1)),
    ) as StoreEvent[]
    expect(expanded.map((e) => e.recurrenceId)).toContain('20260810T090000Z')
    expect(expanded.length).toBeGreaterThan(3)
    for (const e of expanded) {
      expect(e.id).toBeTruthy()
      expect(e.recurrenceId).toBeTruthy()
    }
  })
})
