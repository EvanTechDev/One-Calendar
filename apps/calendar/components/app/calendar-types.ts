export type CalendarViewTypeValue =
  | 'day'
  | 'week'
  | 'four-day'
  | 'month'
  | 'year'

export class CalendarViewType {
  constructor(public readonly value: CalendarViewTypeValue) {}

  static create(value: string): CalendarViewType {
    const validValues: CalendarViewTypeValue[] = [
      'day',
      'week',
      'four-day',
      'month',
      'year',
    ]
    if (!validValues.includes(value as CalendarViewTypeValue)) {
      throw new Error(`Invalid CalendarViewType: ${value}`)
    }
    return new CalendarViewType(value as CalendarViewTypeValue)
  }

  static day(): CalendarViewType {
    return new CalendarViewType('day')
  }
  static week(): CalendarViewType {
    return new CalendarViewType('week')
  }
  static fourDay(): CalendarViewType {
    return new CalendarViewType('four-day')
  }
  static month(): CalendarViewType {
    return new CalendarViewType('month')
  }
  static year(): CalendarViewType {
    return new CalendarViewType('year')
  }

  equals(other: CalendarViewType): boolean {
    return this.value === other.value
  }
  toString(): string {
    return this.value
  }
}

export type FirstDayOfWeekValue = 0 | 1 | 6

export class FirstDayOfWeek {
  constructor(public readonly value: FirstDayOfWeekValue) {}

  static create(value: number): FirstDayOfWeek {
    if (![0, 1, 6].includes(value)) {
      throw new Error(
        `Invalid FirstDayOfWeek: ${value}. Must be 0 (Sunday), 1 (Monday), or 6 (Saturday)`,
      )
    }
    return new FirstDayOfWeek(value as FirstDayOfWeekValue)
  }

  static sunday(): FirstDayOfWeek {
    return new FirstDayOfWeek(0)
  }
  static monday(): FirstDayOfWeek {
    return new FirstDayOfWeek(1)
  }
  static saturday(): FirstDayOfWeek {
    return new FirstDayOfWeek(6)
  }

  equals(other: FirstDayOfWeek): boolean {
    return this.value === other.value
  }
  toNumber(): number {
    return this.value
  }
}

export type LanguageCode = string

export class Language {
  constructor(public readonly code: LanguageCode) {}

  static create(code: string): Language {
    return new Language(code)
  }

  static english(): Language {
    return new Language('en-US')
  }
  static chinese(): Language {
    return new Language('zh-CN')
  }
  static japanese(): Language {
    return new Language('ja-JP')
  }
  static korean(): Language {
    return new Language('ko-KR')
  }
  static french(): Language {
    return new Language('fr-FR')
  }
  static german(): Language {
    return new Language('de-DE')
  }
  static spanish(): Language {
    return new Language('es-ES')
  }
  static italian(): Language {
    return new Language('it-IT')
  }
  static portuguese(): Language {
    return new Language('pt-BR')
  }
  static russian(): Language {
    return new Language('ru-RU')
  }

  equals(other: Language): boolean {
    return this.code === other.code
  }
  toString(): string {
    return this.code
  }
  isChinese(): boolean {
    return this.code.startsWith('zh')
  }
  isEnglish(): boolean {
    return this.code.startsWith('en')
  }
}

export type TimeFormatValue = '24h' | '12h'

export class TimeFormat {
  constructor(public readonly value: TimeFormatValue) {}

  static create(value: string): TimeFormat {
    if (value !== '24h' && value !== '12h') {
      throw new Error(`Invalid TimeFormat: ${value}. Must be '24h' or '12h'`)
    }
    return new TimeFormat(value as TimeFormatValue)
  }

  static h24(): TimeFormat {
    return new TimeFormat('24h')
  }
  static h12(): TimeFormat {
    return new TimeFormat('12h')
  }

  equals(other: TimeFormat): boolean {
    return this.value === other.value
  }
  toString(): string {
    return this.value
  }
  is24Hour(): boolean {
    return this.value === '24h'
  }
  is12Hour(): boolean {
    return this.value === '12h'
  }
}

export interface ViewConfigProps {
  date: Date
  timezone: string
  timeFormat: TimeFormat
  firstDayOfWeek: FirstDayOfWeek
  language: Language
  viewType?: CalendarViewType
}

export class ViewConfig {
  constructor(
    public readonly date: Date,
    public readonly timezone: string,
    public readonly timeFormat: TimeFormat,
    public readonly firstDayOfWeek: FirstDayOfWeek,
    public readonly language: Language,
    public readonly viewType?: CalendarViewType,
  ) {}

  static create(props: ViewConfigProps): ViewConfig {
    if (!props.date || isNaN(props.date.getTime())) {
      throw new Error('ViewConfig requires a valid date')
    }
    if (!props.timezone) {
      throw new Error('ViewConfig requires a timezone')
    }
    return new ViewConfig(
      props.date,
      props.timezone,
      props.timeFormat,
      props.firstDayOfWeek,
      props.language,
      props.viewType,
    )
  }

  static default(): ViewConfig {
    return new ViewConfig(
      new Date(),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      TimeFormat.h24(),
      FirstDayOfWeek.sunday(),
      Language.english(),
    )
  }

  withDate(date: Date): ViewConfig {
    return new ViewConfig(
      date,
      this.timezone,
      this.timeFormat,
      this.firstDayOfWeek,
      this.language,
      this.viewType,
    )
  }

  withTimezone(timezone: string): ViewConfig {
    return new ViewConfig(
      this.date,
      timezone,
      this.timeFormat,
      this.firstDayOfWeek,
      this.language,
      this.viewType,
    )
  }

  withTimeFormat(timeFormat: TimeFormat): ViewConfig {
    return new ViewConfig(
      this.date,
      this.timezone,
      timeFormat,
      this.firstDayOfWeek,
      this.language,
      this.viewType,
    )
  }

  equals(other: ViewConfig): boolean {
    return (
      this.date.getTime() === other.date.getTime() &&
      this.timezone === other.timezone &&
      this.timeFormat.equals(other.timeFormat) &&
      this.firstDayOfWeek.equals(other.firstDayOfWeek) &&
      this.language.equals(other.language) &&
      (this.viewType?.equals(other.viewType ?? CalendarViewType.week()) ??
        false)
    )
  }
}

export interface EventTimeRangeProps {
  start: Date
  end: Date
  isMultiDay: boolean
}

export class EventTimeRange {
  constructor(
    public readonly start: Date,
    public readonly end: Date,
    public readonly isMultiDay: boolean,
  ) {}

  static create(props: EventTimeRangeProps): EventTimeRange {
    if (!props.start || isNaN(props.start.getTime())) {
      throw new Error('EventTimeRange requires a valid start date')
    }
    if (!props.end || isNaN(props.end.getTime())) {
      throw new Error('EventTimeRange requires a valid end date')
    }
    if (props.end < props.start) {
      throw new Error('EventTimeRange end must be after start')
    }
    return new EventTimeRange(props.start, props.end, props.isMultiDay)
  }

  static createForDay(start: Date, end: Date): EventTimeRange {
    const isMultiDay =
      start.getDate() !== end.getDate() ||
      start.getMonth() !== end.getMonth() ||
      start.getFullYear() !== end.getFullYear()
    return new EventTimeRange(start, end, isMultiDay)
  }

  get durationMinutes(): number {
    return Math.round((this.end.getTime() - this.start.getTime()) / (1000 * 60))
  }

  get startMinutes(): number {
    return this.start.getHours() * 60 + this.start.getMinutes()
  }

  get endMinutes(): number {
    return this.end.getHours() * 60 + this.end.getMinutes()
  }

  withStart(start: Date): EventTimeRange {
    return new EventTimeRange(start, this.end, this.isMultiDay)
  }

  withEnd(end: Date): EventTimeRange {
    return new EventTimeRange(this.start, end, this.isMultiDay)
  }

  equals(other: EventTimeRange): boolean {
    return (
      this.start.getTime() === other.start.getTime() &&
      this.end.getTime() === other.end.getTime() &&
      this.isMultiDay === other.isMultiDay
    )
  }

  overlaps(other: EventTimeRange): boolean {
    return this.start < other.end && other.start < this.end
  }

  contains(time: Date): boolean {
    return this.start <= time && time < this.end
  }
}

export const isCalendarView = (view: string): view is CalendarViewTypeValue => {
  return ['day', 'week', 'four-day', 'month', 'year'].includes(view)
}

export const calendarViews = [
  'day',
  'week',
  'four-day',
  'month',
  'year',
] as const

export type ViewType = CalendarViewTypeValue | 'analytics' | 'settings'
