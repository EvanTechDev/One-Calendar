/**


 * "Did the user just type a date?" for the command palette's Go-to-date item.
 *
 * Pure and framework-free on purpose: the palette calls it on every keystroke,
 * and the answer has to be the SAME date the app would navigate to, so this is
 * where the accepted formats are written down in one place instead of being
 * re-derived by the component that renders the menu.
 *
 * Deliberately narrow. It recognises calendar dates a person types at a
 * palette — today, tomorrow, 10/5, 2026-10-05, 5.10.2026, 十月5日 — and returns
 * null for everything else. A free-text question ("next time I see Alex")
 * must fall through to semantic search rather than be read as a date, so any
 * input with extra words in it is null even when it starts with a number.
 */

/** Longest input considered at all; a date never needs more than this. */
const MAX_LENGTH = 24

const RELATIVE_DAYS: Record<string, number> = {
  // English
  today: 0,
  todays: 0,
  tomorrow: 1,
  yesterday: -1,
  // Chinese (the palette's most-used locale, and its users type these)
  今天: 0,
  今日: 0,
  明天: 1,
  明日: 1,
  昨天: -1,
  昨日: -1,
}

/**
 * Parse a palette date query, or return null when it is not one.
 *
 * @param input Raw text from the palette input.
 * @param today The user's "today". Passed in rather than read from the clock
 *   so the caller decides the reference instant and tests can pin it.
 */
export function parseDateQuery(
  input: string,
  today: Date = new Date(),
): Date | null {
  const text = input.trim().toLowerCase()
  if (!text || text.length > MAX_LENGTH) return null

  const relative = RELATIVE_DAYS[text]
  if (relative !== undefined) return atMidnight(addDays(today, relative))

  // 年月日, with or without the characters: 2026年10月5日 / 2026年10月5
  const cn = /^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/.exec(text)
  if (cn) {
    return build(Number(cn[1]), Number(cn[2]), Number(cn[3]))
  }

  // Bare month-day, Chinese style: 10月5日
  const cnMonthDay = /^(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/.exec(text)
  if (cnMonthDay) {
    return build(
      today.getFullYear(),
      Number(cnMonthDay[1]),
      Number(cnMonthDay[2]),
    )
  }

  // ISO first: 2026-10-05. Checked before the slash forms because its dashes
  // are unambiguous, while 2026/10/5 could be D/M/Y in most of the world.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (iso) {
    return build(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }

  const slashed = /^(\d{1,4})\s*[/.]\s*(\d{1,2})\s*[/.]\s*(\d{1,4})$/.exec(text)
  if (slashed) {
    return fromSlashed(slashed, today)
  }

  // Two numbers, the most common thing anyone types: 10/5. Either number
  // being over 12 settles it — a month cannot be 13 or 25 — and otherwise month
  // first is the only reading that is not impossible.
  const monthDay = /^(\d{1,2})\s*[/.]\s*(\d{1,2})$/.exec(text)
  if (monthDay) {
    const first = Number(monthDay[1])
    const second = Number(monthDay[2])
    if (first > 12 && second <= 12) {
      return build(today.getFullYear(), second, first)
    }
    return build(today.getFullYear(), first, second)
  }

  return null
}

/**
 * Decide what a three-number date means. Two-digit and four-digit LEADING
 * numbers are the only ambiguous ones:
 *  - a leading 4-digit number is a year: 2026/10/5 → 2026-10-05
 *  - a leading 1-2 digit number is a day when the middle number can only be a
 *    month (>12): 25/10/2026 → 2026-10-25. Otherwise it is month first:
 *    10/5/2026 → 2026-10-05 (and 10/5, with no year, → this year).
 */
function fromSlashed(match: RegExpExecArray, today: Date): Date | null {
  const first = Number(match[1])
  const second = Number(match[2])
  const third = Number(match[3])

  if (match[1].length === 4) {
    return build(first, second, third)
  }
  if (match[3].length === 4) {
    return build(third, second, first)
  }
  if (second > 12 && first <= 31 && third <= 31) {
    return build(today.getFullYear(), second, first)
  }
  if (third > 31 && first <= 12) {
    return build(today.getFullYear(), first, third)
  }
  // Month first: the only reading of a bare 10/5 that is not impossible.
  return build(today.getFullYear(), first, second)
}

/**
 * A date built from parts, or null when it is not one. `Date` itself would
 * roll 2026-02-31 over into March, and a palette that silently navigates to
 * the wrong month is worse than one that offers no item at all.
 *
 * Callers pass the year explicitly, which is how a bare `1/1` lands in the
 * year currently in view instead of a year the user never mentioned.
 */
function build(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || year < 1) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return atMidnight(date)
}

function atMidnight(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}
