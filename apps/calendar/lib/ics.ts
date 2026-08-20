/**
 * RFC 5545 (iCalendar) serialisation for calendar events.
 *
 * Extracted from the import/export component so the format is unit-testable:
 * a silent regression here corrupts the user's data in a file they take to
 * another calendar, where it is too late to notice.
 *
 * Round-trip contract: `parseICS(generateICSFile(events))` must return the
 * same events (id, title, description, location, all-day flag, reminder,
 * rrule, exdates and instants).
 */

export interface IcsEvent {
  id: string
  title: string
  startDate: Date | string
  endDate: Date | string
  isAllDay?: boolean
  description?: string
  location?: string
  notification?: number
  rrule?: string | null
  exdate?: string[] | null
  color?: string
  calendarId?: string
  participants?: unknown[]
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** RFC 5545 UTC datetime: 20260812T113000Z */
export function formatIcsDateTime(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  )
}

/** RFC 5545 DATE value (all-day, no time and no Z): 20260812 */
export function formatIcsDate(date: Date): string {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`
}

/**
 * Escapes a TEXT value (RFC 5545 §3.3.11). Without this a description holding
 * a comma or semicolon truncates the property in strict parsers.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n')
}

/** Reverses `escapeIcsText` in a single pass so "\\," is not misread. */
export function unescapeIcsText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, ch: string) =>
    ch === 'n' || ch === 'N' ? '\n' : ch,
  )
}

/**
 * Folds a content line at 75 octets with a leading space on continuations
 * (RFC 5545 §3.1). Long descriptions otherwise break importers that enforce
 * the limit.
 */
export function foldIcsLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  if (rest.length > 0) parts.push(` ${rest}`)
  return parts.join('\r\n')
}

/** Minutes-before-start encoded by an alarm TRIGGER, or null. */
export function parseAlarmTriggerMinutes(trigger: string): number | null {
  const match = /^-P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(
    trigger.trim(),
  )
  if (!match) return null
  const minutes =
    Number(match[1] ?? 0) * 1440 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)
  return minutes > 0 ? minutes : null
}

export function generateICSFile(events: IcsEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zentra//One Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  const stamp = formatIcsDateTime(new Date())

  for (const event of events) {
    const startDate = new Date(event.startDate)
    const endDate = new Date(event.endDate)
    const allDay = Boolean(event.isAllDay)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.id}@zentra-calendar`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`CREATED:${stamp}`)
    lines.push(`LAST-MODIFIED:${stamp}`)

    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(startDate)}`)
      lines.push(`DTEND;VALUE=DATE:${formatIcsDate(endDate)}`)
    } else {
      lines.push(`DTSTART:${formatIcsDateTime(startDate)}`)
      lines.push(`DTEND:${formatIcsDateTime(endDate)}`)
    }

    lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(event.title)}`))
    if (event.description) {
      lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(event.description)}`))
    }
    if (event.location) {
      lines.push(foldIcsLine(`LOCATION:${escapeIcsText(event.location)}`))
    }

    // Stored rules have no "RRULE:" prefix, but older imports may carry one —
    // normalise so we never emit "RRULE:RRULE:".
    if (event.rrule) {
      lines.push(`RRULE:${event.rrule.replace(/^RRULE:/i, '')}`)
    }
    if (event.exdate?.length) {
      const dateOnly = event.exdate.every((s) => !s.includes('T'))
      lines.push(
        dateOnly
          ? `EXDATE;VALUE=DATE:${event.exdate.join(',')}`
          : `EXDATE:${event.exdate.join(',')}`,
      )
    }

    lines.push('STATUS:CONFIRMED')
    lines.push('TRANSP:OPAQUE')

    // A reminder becomes a VALARM so other calendars actually notify.
    if (typeof event.notification === 'number' && event.notification > 0) {
      lines.push('BEGIN:VALARM')
      lines.push(`TRIGGER:-PT${event.notification}M`)
      lines.push('ACTION:DISPLAY')
      lines.push('DESCRIPTION:Reminder')
      lines.push('END:VALARM')
    }

    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  // RFC 5545 requires CRLF line endings.
  return `${lines.join('\r\n')}\r\n`
}

/**
 * Parses an ics datetime/date value.
 *
 * All-day (DATE) values are anchored at UTC midnight to match what
 * `formatIcsDate` writes; using local midnight would shift the day by one in
 * any non-UTC zone and break the round-trip.
 */
export function parseICSDate(dateString: string): Date {
  const value = dateString.trim()
  const hasOffset =
    value.includes('+') || (value.includes('-') && value.indexOf('-') > 8)
  const isUTC = value.endsWith('Z')

  if (!value.includes('T')) {
    const year = Number.parseInt(value.substring(0, 4), 10)
    const month = Number.parseInt(value.substring(4, 6), 10) - 1
    const day = Number.parseInt(value.substring(6, 8), 10)
    return new Date(Date.UTC(year, month, day))
  }

  const tIndex = value.indexOf('T')
  const datePart = value.substring(0, tIndex)
  const year = Number.parseInt(datePart.substring(0, 4), 10)
  const month = Number.parseInt(datePart.substring(4, 6), 10) - 1
  const day = Number.parseInt(datePart.substring(6, 8), 10)

  if (hasOffset) {
    const offsetIndex = Math.max(value.lastIndexOf('+'), value.lastIndexOf('-'))
    const timePart = value.substring(tIndex + 1, offsetIndex)
    const offsetPart = value.substring(offsetIndex)
    const hour = Number.parseInt(timePart.substring(0, 2), 10)
    const minute = Number.parseInt(timePart.substring(2, 4), 10)
    const second = Number.parseInt(timePart.substring(4, 6), 10) || 0
    const offsetSign = offsetPart.charAt(0) === '+' ? 1 : -1
    const offsetMinutes =
      offsetSign *
      (Number.parseInt(offsetPart.substring(1, 3), 10) * 60 +
        Number.parseInt(offsetPart.substring(3, 5), 10))
    return new Date(
      Date.UTC(year, month, day, hour, minute, second) -
        offsetMinutes * 60 * 1000,
    )
  }

  const timePart = value.substring(tIndex + 1).replace('Z', '')
  const hour =
    timePart.length >= 2 ? Number.parseInt(timePart.substring(0, 2), 10) : 0
  const minute =
    timePart.length >= 4 ? Number.parseInt(timePart.substring(2, 4), 10) : 0
  const second =
    timePart.length >= 6 ? Number.parseInt(timePart.substring(4, 6), 10) : 0

  // A floating (no Z, no offset) value is local time by definition.
  return isUTC
    ? new Date(Date.UTC(year, month, day, hour, minute, second))
    : new Date(year, month, day, hour, minute, second)
}

/** Unfolds continuation lines (RFC 5545 §3.1) before property parsing. */
function unfoldLines(icsContent: string): string[] {
  const raw = icsContent.split(/\r\n|\n|\r/)
  const out: string[] = []
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.substring(1)
    } else {
      out.push(line)
    }
  }
  return out
}

export function parseICS(
  icsContent: string,
  options: { fallbackTitle?: string; defaultColor?: string } = {},
): IcsEvent[] {
  const fallbackTitle = options.fallbackTitle ?? 'Unnamed Event'
  const defaultColor = options.defaultColor ?? 'bg-[#E6F6FD]'
  const events: IcsEvent[] = []
  let current: Partial<IcsEvent> = {}
  let inEvent = false
  // VALARM properties must not leak into the event: an alarm's DESCRIPTION
  // would otherwise overwrite the event's own.
  let inAlarm = false
  let alarmTrigger: string | null = null

  for (const line of unfoldLines(icsContent)) {
    if (line.startsWith('BEGIN:VALARM')) {
      inAlarm = true
      alarmTrigger = null
      continue
    }
    if (line.startsWith('END:VALARM')) {
      inAlarm = false
      if (inEvent && alarmTrigger) {
        const minutes = parseAlarmTriggerMinutes(alarmTrigger)
        if (minutes !== null) current.notification = minutes
      }
      alarmTrigger = null
      continue
    }
    if (inAlarm) {
      const idx = line.indexOf(':')
      if (idx > 0 && line.substring(0, idx).split(';')[0] === 'TRIGGER') {
        alarmTrigger = line.substring(idx + 1)
      }
      continue
    }

    if (line.startsWith('BEGIN:VEVENT')) {
      current = {
        id: `${Date.now()}${Math.random().toString(36).substring(2, 9)}`,
        title: fallbackTitle,
        isAllDay: false,
        rrule: null,
        participants: [],
        notification: 0,
        color: defaultColor,
        calendarId: '',
      }
      inEvent = true
      continue
    }

    if (line.startsWith('END:VEVENT')) {
      if (inEvent && current.title && current.startDate) {
        if (
          !current.endDate ||
          new Date(current.endDate) < new Date(current.startDate)
        ) {
          current.endDate = new Date(
            new Date(current.startDate).getTime() + 60 * 60 * 1000,
          )
        }
        events.push(current as IcsEvent)
      }
      current = {}
      inEvent = false
      continue
    }

    if (!inEvent) continue

    const colonIndex = line.indexOf(':')
    if (colonIndex <= 0) continue
    const key = line.substring(0, colonIndex)
    const value = line.substring(colonIndex + 1)
    const [mainKey, ...params] = key.split(';')

    switch (mainKey) {
      case 'SUMMARY':
        current.title = unescapeIcsText(value)
        break
      case 'DESCRIPTION':
        current.description = unescapeIcsText(value)
        break
      case 'LOCATION':
        current.location = unescapeIcsText(value)
        break
      case 'UID':
        // Our own export suffixes the UID; strip it so a round-trip keeps the
        // original id instead of accumulating suffixes.
        current.id = value.replace(/@zentra-calendar$/i, '')
        break
      case 'DTSTART':
        try {
          current.startDate = parseICSDate(value)
          current.isAllDay =
            params.includes('VALUE=DATE') || !value.includes('T')
        } catch {
          // Leave the event without a start; it is dropped at END:VEVENT.
        }
        break
      case 'DTEND':
        try {
          current.endDate = parseICSDate(value)
        } catch {
          // Falls back to start + 1h at END:VEVENT.
        }
        break
      case 'RRULE':
        current.rrule = value.replace(/^RRULE:/i, '')
        break
      case 'EXDATE':
        current.exdate = [
          ...(current.exdate ?? []),
          ...value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        ]
        break
    }
  }

  return events
}
