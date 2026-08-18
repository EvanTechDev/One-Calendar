import crypto from 'crypto'
import {
  expandSeries,
  isSeriesEvent,
  mergeOverride,
  parseRfcStamp,
  partsInLocal,
  partsInTz,
  reanchor,
  shiftStamp,
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
  const timezone = opts.timezone
  const explicit = opts.overrides ?? {}
  const overridesBySeries: Record<string, EventRow[]> = {}
  for (const row of rows) {
    if (row.seriesId === null) continue
    const list = overridesBySeries[row.seriesId] ?? []
    list.push(row)
    overridesBySeries[row.seriesId] = list
  }
  for (const [seriesId, list] of Object.entries(explicit)) {
    const merged = overridesBySeries[seriesId] ?? []
    overridesBySeries[seriesId] = [...merged, ...list]
  }

  const result: ExpandedEventRow[] = []
  for (const row of rows) {
    if (row.seriesId !== null) continue
    if (isSeriesEvent(row)) {
      const instances = expandSeries(
        row,
        windowStart,
        windowEnd,
        1000,
        timezone,
      )
      const seriesOverrides = overridesBySeries[row.id] ?? []
      for (const instance of instances) {
        const override =
          seriesOverrides.find(
            (o) => o.recurrenceId === instance.recurrenceId,
          ) ?? null
        const base = {
          ...row,
          startDate: instance.startDate,
          endDate: instance.endDate,
          seriesId: row.id,
          recurrenceId: instance.recurrenceId,
        }
        const merged = override ? mergeOverride(base, override) : base
        result.push({
          ...merged,
          instanceId: instance.id,
          recurrenceId: instance.recurrenceId,
        })
      }
    } else {
      result.push({ ...row, instanceId: row.id, recurrenceId: null })
    }
  }
  return result
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
  let date: Date
  try {
    date = parseRfcStamp(recurrenceId).date
  } catch {
    return null
  }
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
  const base = {
    ...master,
    startDate: date,
    endDate: new Date(date.getTime() + duration),
    seriesId: master.id,
    recurrenceId,
  }
  return override ? mergeOverride(base, override) : base
}

export interface OverrideUpsert {
  id: string
  seriesId: string
  recurrenceId: string
  isNew: boolean
  fields: Record<string, unknown>
}

export interface SplitPlan {
  masterUntil: string
  masterExdate: string[]
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
    return {
      applyTo,
      exdateToAdd: exdate.includes(recurrenceId) ? null : recurrenceId,
      overrideUpsert: {
        id: crypto.randomUUID(),
        seriesId: master.id,
        recurrenceId,
        isNew: true,
        fields: {
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
  const startDate =
    target.fields?.startDate ?? override?.startDate ?? patternStart
  const endDate =
    target.fields?.endDate ??
    override?.endDate ??
    new Date((startDate as Date).getTime() + duration)
  const isAllDay =
    target.fields?.isAllDay ?? override?.isAllDay ?? master.isAllDay
  const rule = master.rrule ?? ''
  const existingExdate = master.exdate ?? []
  const splitExdate = existingExdate.filter((stamp) => stamp > recurrenceId)
  const masterExdate = existingExdate.filter((stamp) => stamp <= recurrenceId)
  if (!masterExdate.includes(recurrenceId)) masterExdate.push(recurrenceId)
  const moveOverrideIds = (target.overrides ?? [])
    .filter((o) => o.recurrenceId !== null && o.recurrenceId > recurrenceId)
    .map((o) => o.id)
  const deltaMs =
    new Date(startDate as Date).getTime() -
    parseRfcStamp(recurrenceId).date.getTime()
  const shiftedSplitExdate = splitExdate.map((stamp) =>
    shiftStamp(stamp, deltaMs),
  )

  return {
    applyTo,
    exdateToAdd: null,
    overrideUpsert: null,
    deleteOverrideId: override?.id ?? null,
    split: {
      masterUntil: recurrenceId,
      masterExdate,
      newSeries: {
        id: crypto.randomUUID(),
        rrule: reanchor(rule, startDate as Date, isAllDay),
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
