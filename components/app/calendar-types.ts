export type CalendarViewType = 'day' | 'week' | 'four-day' | 'month' | 'year'

export type ViewType = CalendarViewType | 'analytics' | 'settings'

export type FirstDayOfWeek = 0 | 1

const calendarViews = ['day', 'week', 'four-day', 'month', 'year'] as const

export const isCalendarView = (view: string): view is CalendarViewType =>
  calendarViews.includes(view as CalendarViewType)
