import { useEffect } from 'react'
import { useLanguage } from '@zntr/i18n/calendar'
import { addDays, addYears, subDays, subYears } from 'date-fns'
import { isCalendarView } from '@/components/app/calendar-types'
import type { FirstDayOfWeek, ViewType } from '@/components/app/calendar-types'
import { useLocalStorage } from '@zntr/utils/useLocalStorage'

interface UseViewManagementOptions {
  _date: Date
  view: ViewType
  setDate: (date: Date | ((prevDate: Date) => Date)) => void
  setView: (view: ViewType) => void
  _defaultView: string
  _setDefaultView: (view: string) => void
}

export function useViewManagement({
  _date,
  view,
  setDate,
  setView,
  _defaultView,
  _setDefaultView,
}: UseViewManagementOptions) {
  const [language] = useLanguage()

  const [firstDayOfWeek, setFirstDayOfWeek] = useLocalStorage<FirstDayOfWeek>(
    'first-day-of-week',
    0,
  )
  const normalizedFirstDayOfWeek: FirstDayOfWeek =
    firstDayOfWeek === 1 || firstDayOfWeek === 6 ? firstDayOfWeek : 0

  useEffect(() => {
    setView(isCalendarView(_defaultView) ? _defaultView : 'week')
  }, [_defaultView])

  const handleFirstDayOfWeekChange = (day: FirstDayOfWeek) => {
    setFirstDayOfWeek(day)
  }

  const handleTodayClick = () => {
    const today = new Date()
    setDate(today)
  }

  const handlePrevious = () => {
    setDate((prevDate: Date) => {
      if (view === 'day') return subDays(prevDate, 1)
      if (view === 'week') return subDays(prevDate, 7)
      if (view === 'four-day') return subDays(prevDate, 4)
      if (view === 'year') return subYears(prevDate, 1)
      return subDays(prevDate, 30)
    })
  }

  const handleNext = () => {
    setDate((prevDate: Date) => {
      if (view === 'day') return addDays(prevDate, 1)
      if (view === 'week') return addDays(prevDate, 7)
      if (view === 'four-day') return addDays(prevDate, 4)
      if (view === 'year') return addYears(prevDate, 1)
      return addDays(prevDate, 30)
    })
  }

  const formatDateDisplay = (date: Date) => {
    if (view === 'year') {
      return date.getFullYear().toString()
    }

    if (view === 'four-day') {
      const startDate = new Date(date)
      const endDate = addDays(startDate, 3)
      const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
      }
      return `${startDate.toLocaleDateString(language, options)} - ${endDate.toLocaleDateString(language, options)}`
    }

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
    }
    return date.toLocaleDateString(language, options)
  }

  return {
    firstDayOfWeek,
    setFirstDayOfWeek: handleFirstDayOfWeekChange,
    handleTodayClick,
    handlePrevious,
    handleNext,
    formatDateDisplay,
    normalizedFirstDayOfWeek,
  }
}
