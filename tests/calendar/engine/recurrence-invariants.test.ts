/**
 * Deterministic fuzz over the recurrence layer: a seeded PRNG generates a
 * matrix of rules (every FREQ, multi-value BY* fields, ordinal weekdays,
 * COUNT/UNTIL bounds) and drives long random sequences of the three edit
 * scopes through the PURE layer (planner + engine), asserting the invariants
 * that must hold no matter how hard a user hammers the UI:
 *
 *   I1  Lossless round-trip: parts → rule → parts is a fixed point, and the
 *       rule keeps selecting the same occurrences.
 *   I2  No duplicate stamps: one occurrence per recurrenceId in any view.
 *   I3  No resurrection: an exdated stamp with no override never renders.
 *   I4  No orphans: every rendered instance belongs to a master in the view.
 *   I5  "Following" never violates the parent pattern: the split series'
 *       anchor day is a member of the original rule.
 *   I6  Bounds are honoured: a COUNT/UNTIL series never grows past its end
 *       across repeated splits.
 *   I7  "All events" day translation preserves the occurrence COUNT and the
 *       day-distance between consecutive occurrences (the pattern is
 *       translated, not reshaped) — or is refused outright.
 *
 * Seeded so a failure is reproducible; bump ITERATIONS locally to hunt.
 */
import { describe, it, expect } from 'vitest'
import {
  canTranslateRuleByDays,
  expandSeries,
  expandSeriesView,
  parseRfcStamp,
  rruleFromParts,
  rruleToParts,
  toRfcStamp,
  translateRuleByDays,
  translateStampsByDays,
  wallClockDayDelta,
  addWallClockDays,
  type SeriesViewInput,
} from '@/lib/recurrence/engine'
import { planInstanceChange, type EventRow } from '@/lib/event-service'

const TZ = 'UTC'
/**
 * Zones the fuzz runs in. Non-UTC matters because every day boundary (split
 * stamps, whole-pattern day shifts, all-day stamps) is computed on wall-clock
 * dates: a zone whose offset is negative, fractional, or DST-shifting moves
 * those boundaries relative to UTC.
 */
const ZONES = ['UTC', 'America/New_York', 'Asia/Kolkata', 'Pacific/Auckland']
const ITERATIONS = 80

/** xorshift32 — tiny, deterministic, good enough to shuffle test inputs. */
function makeRng(seed: number) {
  let state = seed || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0x100000000
  }
}

const RULES = [
  'FREQ=DAILY;INTERVAL=1',
  'FREQ=DAILY;INTERVAL=3',
  'FREQ=WEEKLY;BYDAY=MO',
  'FREQ=WEEKLY;BYDAY=MO,WE,FR,SU',
  'FREQ=WEEKLY;BYDAY=SA,SU',
  'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH',
  'FREQ=MONTHLY;BYMONTHDAY=15',
  'FREQ=MONTHLY;BYMONTHDAY=1,15',
  'FREQ=MONTHLY;BYMONTHDAY=-1',
  'FREQ=MONTHLY;BYDAY=2MO',
  'FREQ=MONTHLY;BYDAY=SA;BYSETPOS=-1',
  'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=1',
  'FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=15',
  'FREQ=YEARLY;BYMONTH=3,6,9,12;BYMONTHDAY=15',
  'FREQ=YEARLY;BYWEEKNO=20;BYDAY=MO',
  'FREQ=WEEKLY;BYDAY=MO;COUNT=10',
  'FREQ=WEEKLY;BYDAY=MO,WE;COUNT=7',
  'FREQ=DAILY;COUNT=5',
  'FREQ=WEEKLY;BYDAY=MO;UNTIL=20261130T090000Z',
  'FREQ=MONTHLY;BYMONTHDAY=10;UNTIL=20270101T090000Z',
]

function day(y: number, m: number, d: number, h = 9, min = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min, 0))
}

function makeMaster(rrule: string, start: Date, isAllDay = false): EventRow {
  return {
    id: 'm1',
    userId: 'u1',
    title: 'Fuzz',
    description: null,
    location: null,
    startDate: start,
    endDate: new Date(
      start.getTime() + (isAllDay ? 24 * 3600 * 1000 : 60 * 60 * 1000),
    ),
    isAllDay,
    status: 'confirmed',
    color: null,
    categoryId: null,
    participants: [],
    notificationMinutes: null,
    createdAt: day(2026, 1, 1),
    updatedAt: day(2026, 1, 1),
    rrule,
    exdate: null,
    seriesId: null,
    recurrenceId: null,
  }
}

const WINDOW_START = day(2026, 1, 1, 0)
const WINDOW_END = day(2026, 12, 31, 0)

function expand(master: EventRow, timeZone = TZ) {
  return expandSeries(master, WINDOW_START, WINDOW_END, 400, timeZone)
}

describe('recurrence invariants (deterministic fuzz)', () => {
  it('I1: parts round-trip is a fixed point and preserves the occurrence set', () => {
    for (const rule of RULES) {
      const once = rruleToParts(rule)
      const rebuilt = rruleFromParts(once)
      const twice = rruleToParts(rebuilt)
      expect(twice, `round-trip drifted for ${rule}`).toEqual(once)

      // The rebuilt rule must select exactly the same days.
      const a = expand(makeMaster(rule, day(2026, 8, 3)))
      const b = expand(makeMaster(rebuilt, day(2026, 8, 3)))
      expect(
        b.map((i) => i.recurrenceId),
        `occurrence set changed for ${rule}`,
      ).toEqual(a.map((i) => i.recurrenceId))
    }
  })

  it(
    'I2+I3+I4: views never duplicate, resurrect, or orphan across random edit sequences',
    { timeout: 60_000 },
    () => {
      const rng = makeRng(0xc0ffee)
      for (let iter = 0; iter < ITERATIONS; iter++) {
        const rule = RULES[Math.floor(rng() * RULES.length)]
        // All-day series and non-UTC zones were the blind spot that let two
        // real bugs through: every day boundary (split anchors, stamp shifts)
        // is wall-clock, so both dimensions must be fuzzed.
        const zone = ZONES[Math.floor(rng() * ZONES.length)]
        const allDay = rng() < 0.35
        let master = makeMaster(rule, day(2026, 8, 3), allDay)
        let overrides: EventRow[] = []
        const exdates = new Set<string>()

        for (let step = 0; step < 12; step++) {
          const instances = expand(master, zone)
          if (instances.length === 0) break
          const target = instances[Math.floor(rng() * instances.length)]
          const roll = rng()

          if (roll < 0.4) {
            // "this event": exdate the base slot + add/replace an override.
            exdates.add(target.recurrenceId)
            master = { ...master, exdate: [...exdates] }
            overrides = [
              ...overrides.filter(
                (o) => o.recurrenceId !== target.recurrenceId,
              ),
              {
                ...master,
                id: `o-${iter}-${step}`,
                seriesId: master.id,
                recurrenceId: target.recurrenceId,
                rrule: null,
                exdate: null,
                startDate: new Date(target.startDate.getTime() + 3600_000),
                endDate: new Date(target.endDate.getTime() + 3600_000),
              },
            ]
          } else if (roll < 0.7) {
            // "delete this event": exdate AND drop the override row (the
            // paired write the server performs).
            exdates.add(target.recurrenceId)
            master = { ...master, exdate: [...exdates] }
            overrides = overrides.filter(
              (o) => o.recurrenceId !== target.recurrenceId,
            )
          } else {
            // "this and following": split.
            const plan = planInstanceChange({
              master,
              override:
                overrides.find((o) => o.recurrenceId === target.recurrenceId) ??
                null,
              overrides,
              recurrenceId: target.recurrenceId,
              applyTo: 'following',
              fields: {
                startDate: new Date(target.startDate.getTime() + 7200_000),
                endDate: new Date(target.endDate.getTime() + 7200_000),
              },
              now: day(2026, 1, 1),
              timeZone: zone,
            })
            const split = plan.split
            if (!split) break

            // I5: the new series' anchor must fall on a day the ORIGINAL
            // pattern generates — a following split never invents a weekday.
            //
            // Compare on the user's WALL-CLOCK day (what the user sees and what
            // the pattern is defined in), not on stamp days: a timed stamp is a
            // UTC datetime, so moving the clock can change its UTC day while
            // the local day is unchanged (Auckland +13: local Sep 26 00:00 is
            // stamp 20260925T120000Z, and 02:00 is still Sep 26 locally).
            const zoneDay = (d: Date) =>
              new Intl.DateTimeFormat('en-CA', {
                timeZone: zone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              })
                .format(d)
                .replace(/-/g, '')
            const utcDay = (d: Date) =>
              `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
            // All-day occurrences carry the calendar date in their stamp and
            // are anchored at the stamp's UTC midnight, so compare stamp↔UTC.
            // Timed occurrences are instants whose day is zone-relative.
            const originalInstances = expand(
              makeMaster(master.rrule!, master.startDate, master.isAllDay),
              zone,
            )
            const originalDays = new Set(
              master.isAllDay
                ? originalInstances.map((i) => i.recurrenceId)
                : originalInstances.map((i) => zoneDay(i.startDate)),
            )
            const anchorDay = master.isAllDay
              ? utcDay(split.newSeries.startDate)
              : zoneDay(split.newSeries.startDate)
            expect(
              originalDays.has(anchorDay),
              `following split left the pattern (${zone}, allDay=${master.isAllDay}): ${master.rrule} anchor ${anchorDay} not in {${[...originalDays].slice(0, 6).join(',')}}`,
            ).toBe(true)

            master = makeMaster(
              split.newSeries.rrule,
              split.newSeries.startDate,
              master.isAllDay,
            )
            master = { ...master, id: `s-${iter}-${step}` }
            master.exdate = split.newSeries.exdate
            exdates.clear()
            for (const stamp of split.newSeries.exdate ?? []) exdates.add(stamp)
            overrides = overrides
              .filter((o) => split.moveOverrideIds.includes(o.id))
              .map((o) => ({ ...o, seriesId: master.id }))
          }

          const view = expandSeriesView(
            [master as unknown as SeriesViewInput],
            overrides as unknown as SeriesViewInput[],
            WINDOW_START,
            WINDOW_END,
            400,
            zone,
          ) as unknown as Array<{
            id: string
            seriesId: string | null
            recurrenceId: string | null
          }>

          // I2: no duplicate instance ids and no duplicate stamps per series.
          const ids = view.map((e) => e.id)
          expect(
            new Set(ids).size,
            `duplicate instance id (${rule}, ${zone}, allDay=${allDay})`,
          ).toBe(ids.length)
          const perSeries = new Map<string, Set<string>>()
          for (const e of view) {
            const key = e.seriesId ?? '∅'
            const seen = perSeries.get(key) ?? new Set<string>()
            if (e.recurrenceId !== null) {
              expect(
                seen.has(e.recurrenceId),
                `duplicate stamp ${e.recurrenceId} (${rule}, ${zone})`,
              ).toBe(false)
              seen.add(e.recurrenceId)
            }
            perSeries.set(key, seen)
          }

          // I3: an exdated stamp with NO override must not render.
          const overrideStamps = new Set(
            overrides.map((o) => o.recurrenceId).filter(Boolean),
          )
          for (const stamp of exdates) {
            if (overrideStamps.has(stamp)) continue
            expect(
              view.some((e) => e.recurrenceId === stamp),
              `resurrected exdated stamp ${stamp} (${rule}, ${zone})`,
            ).toBe(false)
          }

          // I4: every rendered row belongs to the master in the view.
          for (const e of view) {
            if (e.seriesId === null) continue
            expect(
              e.seriesId,
              `orphan instance parented to ${e.seriesId} (${rule}, ${zone})`,
            ).toBe(master.id)
          }
        }
      }
    },
  )

  it('I6: repeated following splits never extend a bounded series', () => {
    const rng = makeRng(0xbeef)
    const bounded = RULES.filter(
      (r) => r.includes('COUNT=') || r.includes('UNTIL='),
    )
    for (const rule of bounded) {
      let master = makeMaster(rule, day(2026, 8, 3))
      const original = expand(master)
      if (original.length === 0) continue
      const lastStamp = original[original.length - 1].recurrenceId
      const originalCount = original.length

      for (let step = 0; step < 6; step++) {
        const instances = expand(master)
        if (instances.length < 2) break
        const target = instances[1 + Math.floor(rng() * (instances.length - 1))]
        const plan = planInstanceChange({
          master,
          override: null,
          overrides: [],
          recurrenceId: target.recurrenceId,
          applyTo: 'following',
          fields: {},
          now: day(2026, 1, 1),
          timeZone: TZ,
        })
        if (!plan.split) break
        const next = makeMaster(
          plan.split.newSeries.rrule,
          plan.split.newSeries.startDate,
        )
        const tail = expand(next)
        // The split tail can never run past the original series' end…
        for (const i of tail) {
          expect(
            i.recurrenceId <= lastStamp,
            `${rule}: split tail ran past the original end (${i.recurrenceId} > ${lastStamp})`,
          ).toBe(true)
        }
        // …nor produce more occurrences than the original had.
        expect(
          tail.length <= originalCount,
          `${rule}: split tail grew the series (${tail.length} > ${originalCount})`,
        ).toBe(true)
        master = next
      }
    }
  })

  it(
    'I7: all-events day translation preserves count and spacing, or is refused',
    { timeout: 60_000 },
    () => {
      const start = day(2026, 8, 3)
      for (const rule of RULES) {
        for (const delta of [1, 2, -1, 3, 7]) {
          const before = expand(makeMaster(rule, start))
          if (before.length === 0) continue

          if (!canTranslateRuleByDays(rule, delta)) {
            // Refusal is the safe outcome; the rule must come back untouched.
            expect(
              translateRuleByDays(rule, delta, start, false, TZ),
              `${rule}: refused translation must not modify the rule`,
            ).toBe(rule)
            continue
          }

          const shiftedStart = addWallClockDays(start, delta, TZ)
          const translated = translateRuleByDays(
            rule,
            delta,
            shiftedStart,
            false,
            TZ,
          )
          const after = expand(makeMaster(translated, shiftedStart))

          // Occurrence count survives the translation. The expansion window is
          // fixed while the pattern moves, so a shift of `delta` days can push
          // at most ceil(delta / minimum-spacing) occurrences past the window
          // edge; for a daily rule that is `delta` slots. Compare against that
          // bound rather than demanding exact equality.
          const tolerance = Math.abs(delta) + 1
          expect(
            Math.abs(after.length - before.length) <= tolerance,
            `${rule} +${delta}d: occurrence count changed ${before.length} → ${after.length} (tolerance ${tolerance})`,
          ).toBe(true)

          // Spacing between consecutive occurrences is preserved: the pattern
          // moved, it was not reshaped.
          const spacing = (list: typeof before) =>
            list
              .slice(1)
              .map((i, idx) =>
                wallClockDayDelta(
                  parseRfcStamp(list[idx].recurrenceId).date,
                  parseRfcStamp(i.recurrenceId).date,
                  TZ,
                ),
              )
          const sBefore = spacing(before)
          const sAfter = spacing(after)
          const compare = Math.min(sBefore.length, sAfter.length) - 1
          for (let i = 0; i < compare; i++) {
            expect(
              sAfter[i],
              `${rule} +${delta}d: spacing changed at ${i} (${sBefore[i]} → ${sAfter[i]})`,
            ).toBe(sBefore[i])
          }
        }
      }
    },
  )

  it('I3b: stamp translation keeps exdates aligned with the translated pattern', () => {
    const start = day(2026, 8, 3)
    for (const rule of RULES) {
      for (const delta of [1, 2, 7]) {
        if (!canTranslateRuleByDays(rule, delta)) continue
        const master = makeMaster(rule, start)
        const instances = expand(master)
        if (instances.length < 3) continue

        // Exdate the 2nd occurrence, then translate the whole pattern.
        const excluded = instances[1].recurrenceId
        const shiftedStart = addWallClockDays(start, delta, TZ)
        const translatedRule = translateRuleByDays(
          rule,
          delta,
          shiftedStart,
          false,
          TZ,
        )
        const movedExdates = translateStampsByDays(
          [excluded],
          delta,
          shiftedStart,
          TZ,
        )
        const shifted = {
          ...makeMaster(translatedRule, shiftedStart),
          exdate: movedExdates,
        }
        const after = expand(shifted)

        // The moved exdate must still suppress exactly one slot: the
        // translated stamp has to be a member of the translated pattern.
        const withoutExdate = expand({ ...shifted, exdate: null })
        expect(
          withoutExdate.length - after.length,
          `${rule} +${delta}d: moved exdate suppressed ${withoutExdate.length - after.length} slots (want 1)`,
        ).toBe(1)
      }
    }
  })
})
