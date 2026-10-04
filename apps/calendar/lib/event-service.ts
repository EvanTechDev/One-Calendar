import crypto from 'crypto'
import {
  expandSeries,
  expandSeriesView,
  firstVisibleStampOfSeries,
  isSeriesEvent,
  mergeOverride,
  parseRfcStamp,
  partsInLocal,
  partsInTz,
  reanchor,
  remainingSeriesCount,
  rruleFromParts,
  rruleToParts,
  shiftExdates,
  snapToPatternDay,
  toRfcStamp,
  wallClockToInstant,
} from '@/lib/recurrence/engine'

export { mergeOverride } from '@/lib/recurrence/engine'

export type ApplyTo = 'all' | 'single' | 'following'

export interface EventRow {
  id: string
  userId: string
  title: string
  description: string | null
  location: string | null
  startDate: Date
  endDate: Date
  isAllDay: boolean
  status: string
  color: string | null
  categoryId: string | null
  participants: string[]
  notificationMinutes: number | null
  /** Also deliver the reminder by email. See ADR-0010. */
  emailReminder: boolean
  createdAt: Date
  updatedAt: Date
  rrule: string | null
  exdate: string[] | null
  seriesId: string | null
  recurrenceId: string | null
}

export type ExpandedEventRow = EventRow & {
  instanceId: string
  recurrenceId: string | null
}

const MUTABLE_FIELDS = [
  'title',
  'description',
  'location',
  'startDate',
  'endDate',
  'isAllDay',
  'status',
  'color',
  'categoryId',
  'participants',
  'notificationMinutes',
  // A reminder setting, so an override may carry its own.
  'emailReminder',
] as const

function pickMutable(
  fields: Partial<EventRow>,
): Record<(typeof MUTABLE_FIELDS)[number], unknown> {
  const picked: Record<string, unknown> = {}
  for (const key of MUTABLE_FIELDS) {
    if (fields[key] !== undefined) {
      picked[key] = fields[key]
    }
  }
  return picked as Record<(typeof MUTABLE_FIELDS)[number], unknown>
}

/**
 * The stamp of the series' first occurrence, IGNORING exdates.
 *
 * Prefer `resolveMasterEditStamp` for edit/delete targeting: this function
 * happily returns a stamp the series no longer renders (because the user
 * deleted that occurrence), and writing to a non-existent slot leaves an
 * orphan override plus a dead exdate. Kept because the raw master-start stamp
 * is still the right answer when constructing a series, not editing one.
 */
export function firstStampOfSeries(
  master: EventRow,
  timeZone?: string,
): string {
  const start = new Date(master.startDate)
  if (master.isAllDay) {
    const parts = timeZone ? partsInTz(start, timeZone) : partsInLocal(start)
    return `${parts.year}${pad2(parts.month)}${pad2(parts.day)}`
  }
  return toRfcStamp(start, false)
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/**
 * Which occurrence a master-id edit or delete should act on: the series' first
 * VISIBLE occurrence, i.e. the first generated slot that no exdate removes.
 *
 * Using the raw master start (see `firstStampOfSeries`) targets an occurrence
 * the user already deleted, so the write lands on a slot the engine never
 * renders — the resulting override becomes an orphan and the exdate is dead
 * weight. Falls back to the raw stamp when nothing is visible (a fully
 * exhausted or fully excluded series), so callers always get a usable stamp.
 */
export function resolveMasterEditStamp(
  master: EventRow,
  timeZone?: string,
): string {
  return (
    firstVisibleStampOfSeries(master, timeZone) ??
    firstStampOfSeries(master, timeZone)
  )
}

export function expandRows(
  rows: EventRow[],
  opts: {
    windowStart?: Date
    windowEnd?: Date
    overrides?: Record<string, EventRow[]>
    timezone?: string
  } = {},
): ExpandedEventRow[] {
  const windowStart = opts.windowStart ?? new Date(-8640000000000000)
  const windowEnd = opts.windowEnd ?? new Date(8640000000000000)
  // Use the same override reconciliation as the calendar. An EXDATE plus an
  // override is an edited occurrence, not a deletion: expanding only the base
  // slots silently dropped these rows from MCP lists and analytics (CORE-219).
  const overrides = [
    ...rows.filter((row) => row.seriesId !== null),
    ...Object.values(opts.overrides ?? {}).flat(),
  ]
  return expandSeriesView(
    rows.map((row) => ({ ...row })),
    overrides.map((row) => ({ ...row })),
    windowStart,
    windowEnd,
    1000,
    opts.timezone,
  ).map((row) => ({ ...row, instanceId: row.id }))
}

export function resolveInstance(
  master: EventRow,
  recurrenceId: string,
  overrides: EventRow[] = [],
  timeZone?: string,
): EventRow | null {
  if (!isSeriesEvent(master)) return null
  const override = overrides.find((o) => o.recurrenceId === recurrenceId)
  if (!override && (master.exdate ?? []).includes(recurrenceId)) return null
  let base: EventRow
  try {
    base = occurrenceBase(master, recurrenceId, timeZone)
  } catch {
    return null
  }
  return override ? mergeOverride(base, override) : base
}

/**
 * The occurrence of `master` at `recurrenceId` as it would appear with no
 * override applied: the master's fields with start/end moved to the slot.
 * Throws when the stamp is unparseable.
 */
function occurrenceBase(
  master: EventRow,
  recurrenceId: string,
  timeZone?: string,
): EventRow {
  let date = parseRfcStamp(recurrenceId).date
  if (master.isAllDay && timeZone) {
    const match = recurrenceId.match(/^(\d{4})(\d{2})(\d{2})$/)
    if (match) {
      date = wallClockToInstant(
        {
          year: Number(match[1]),
          month: Number(match[2]),
          day: Number(match[3]),
          hour: 0,
          minute: 0,
          second: 0,
        },
        { hour: 0, minute: 0, second: 0 },
        timeZone,
      )
    }
  }
  const duration = master.endDate.getTime() - master.startDate.getTime()
  return {
    ...master,
    startDate: date,
    endDate: new Date(date.getTime() + duration),
    seriesId: master.id,
    recurrenceId,
  }
}

interface OverrideUpsert {
  id: string
  seriesId: string
  recurrenceId: string
  isNew: boolean
  fields: Record<string, unknown>
}

interface SplitPlan {
  masterUntil: string
  masterExdate: string[]
  /**
   * True when the truncated old master would generate no visible occurrence
   * at all (the split happened at its first/only remaining slot). Callers
   * must DELETE that row instead of writing a truncated rule: a zombie master
   * accumulates on every repeated "this and following" edit and keeps
   * re-parenting overrides to a series nobody can see.
   */
  masterBecomesEmpty: boolean
  newSeries: {
    id: string
    rrule: string
    startDate: Date
    endDate: Date
    exdate: string[] | null
    fields: Record<string, unknown>
  }
  moveOverrideIds: string[]
}

export interface InstanceChangePlan {
  applyTo: ApplyTo
  exdateToAdd: string | null
  overrideUpsert: OverrideUpsert | null
  deleteOverrideId: string | null
  split: SplitPlan | null
}

export interface InstanceChangeTarget {
  master: EventRow
  override: EventRow | null
  overrides?: EventRow[]
  recurrenceId: string
  applyTo: ApplyTo
  fields?: Partial<EventRow>
  now?: Date
  /** User's IANA timezone — keeps split-boundary day math aligned with the
   * expansion engine's. Falls back to server-local day parts. */
  timeZone?: string
}

export function planInstanceChange(
  target: InstanceChangeTarget,
): InstanceChangePlan {
  const { master, override, recurrenceId, applyTo } = target
  const now = target.now ?? new Date()

  if (applyTo === 'all') {
    return {
      applyTo,
      exdateToAdd: null,
      overrideUpsert: null,
      deleteOverrideId: null,
      split: null,
    }
  }

  if (applyTo === 'single') {
    if (override) {
      return {
        applyTo,
        exdateToAdd: null,
        overrideUpsert: {
          id: override.id,
          seriesId: master.id,
          recurrenceId: override.recurrenceId ?? recurrenceId,
          isNew: false,
          fields: {
            ...pickMutable(mergeOverride(override, target.fields ?? {})),
            updatedAt: now,
          },
        },
        deleteOverrideId: null,
        split: null,
      }
    }
    const exdate = master.exdate ?? []
    // A new override is a full row (title/start/end are NOT NULL), so a
    // partial change — e.g. colour only through the MCP — must be laid over
    // the occurrence it detaches from, never written as submitted.
    const occurrence = occurrenceBase(master, recurrenceId, target.timeZone)
    return {
      applyTo,
      exdateToAdd: exdate.includes(recurrenceId) ? null : recurrenceId,
      overrideUpsert: {
        id: crypto.randomUUID(),
        seriesId: master.id,
        recurrenceId,
        isNew: true,
        fields: {
          ...pickMutable(occurrence),
          ...pickMutable(target.fields ?? {}),
          createdAt: now,
          updatedAt: now,
        },
      },
      deleteOverrideId: null,
      split: null,
    }
  }

  const duration = master.endDate.getTime() - master.startDate.getTime()
  const patternStart = parseRfcStamp(recurrenceId).date
  const requestedStart =
    target.fields?.startDate ?? override?.startDate ?? patternStart
  const requestedEnd =
    target.fields?.endDate ??
    override?.endDate ??
    new Date((requestedStart as Date).getTime() + duration)
  const isAllDay =
    target.fields?.isAllDay ?? override?.isAllDay ?? master.isAllDay
  // "This and following" must NOT violate the parent pattern: dragging
  // Wednesday's instance to Tuesday 15:00 in a Mon/Wed/Fri/Sun series moves
  // the tail to 15:00 on its OWN pattern days — it does not add Tuesdays.
  // The new series' anchor therefore snaps back to the dragged occurrence's
  // day and keeps only the new time of day.
  //
  // All-day series get the SAME treatment: they have no clock to adopt, so a
  // cross-day drag carries no information the tail can use, and the anchor
  // stays exactly on the pattern day. (Previously the requested day was used
  // verbatim, which is how an all-day Mon/Wed/Fri/Sun series ended up
  // anchored on a Tuesday it never generates.)
  const startDate = isAllDay
    ? patternStart
    : snapToPatternDay(patternStart, requestedStart as Date, target.timeZone)
  // Duration is taken from the request either way, so a resize still applies.
  const endDate = new Date(
    (startDate as Date).getTime() +
      ((requestedEnd as Date).getTime() - (requestedStart as Date).getTime()),
  )
  const rule = master.rrule ?? ''
  const requestedRule = target.fields?.rrule
  const ruleChanged =
    !!requestedRule &&
    rruleFromParts(rruleToParts(requestedRule)) !==
      rruleFromParts(rruleToParts(rule))
  const existingExdate = master.exdate ?? []
  const splitExdate = existingExdate.filter((stamp) => stamp > recurrenceId)
  const masterExdate = existingExdate.filter((stamp) => stamp <= recurrenceId)
  if (!masterExdate.includes(recurrenceId)) masterExdate.push(recurrenceId)
  const moveOverrideIds = (target.overrides ?? [])
    .filter((o) => o.recurrenceId !== null && o.recurrenceId > recurrenceId)
    .map((o) => o.id)
  // Inherited exdates and moved overrides are both clock-remapped to the new
  // series' anchor clock: the split series keeps the original rule's day
  // pattern (reanchor only adopts the new time-of-day), so stamps must keep
  // their original day and take the new clock to match the generated slots.
  const shiftedSplitExdate = splitExdate.length
    ? (shiftExdates(splitExdate, startDate as Date, target.timeZone) ?? [])
    : []

  // Does the old series still render anything once truncated at the split
  // boundary (UNTIL is inclusive, and masterExdate excludes the boundary
  // itself)? If not, the caller must drop the row rather than keep an
  // invisible master around.
  const truncatedMaster: EventRow = {
    ...master,
    rrule: rule,
    exdate: masterExdate,
  }
  const remainingBefore = expandSeries(
    truncatedMaster,
    new Date(master.startDate.getTime() - 2 * 24 * 3600 * 1000),
    patternStart,
    2,
    target.timeZone,
  ).filter((i) => i.recurrenceId < recurrenceId)
  const masterBecomesEmpty = remainingBefore.length === 0

  return {
    applyTo,
    exdateToAdd: null,
    overrideUpsert: null,
    deleteOverrideId: override?.id ?? null,
    split: {
      masterUntil: recurrenceId,
      masterExdate,
      masterBecomesEmpty,
      newSeries: {
        id: crypto.randomUUID(),
        // An explicit new rule supplies its own bounds. Otherwise UNTIL
        // carries over and COUNT is re-based to the remaining length.
        rrule: reanchor(
          ruleChanged ? requestedRule : rule,
          startDate as Date,
          isAllDay,
          ruleChanged
            ? rruleToParts(requestedRule).count
            : remainingSeriesCount(
                rule,
                master.startDate,
                patternStart,
                target.timeZone,
              ),
        ),
        startDate: startDate as Date,
        endDate: endDate as Date,
        exdate: shiftedSplitExdate.length > 0 ? shiftedSplitExdate : null,
        fields: {
          ...pickMutable(mergeOverride(master, target.fields ?? {})),
          startDate: startDate as Date,
          endDate: endDate as Date,
          isAllDay,
        },
      },
      moveOverrideIds,
    },
  }
}
