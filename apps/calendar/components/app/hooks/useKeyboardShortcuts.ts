'use client'

import { useEffect } from 'react'
import { useLanguage } from '@zntr/i18n/calendar'
import {
  type CalendarViewType,
  type ViewType,
} from '@/components/app/calendar-types'

interface UseKeyboardShortcutsOptions {
  date: Date
  view: ViewType
  _setDate: (date: Date) => void
  setView: (view: ViewType) => void
  setSelectedEvent: (event: null) => void
  setQuickCreateStartTime: (date: Date) => void
  setEventDialogOpen: (open: boolean) => void
  handleTodayClick: () => void
  handlePrevious: () => void
  handleNext: () => void
  defaultView: CalendarViewType
  enableShortcuts: boolean
}

export function useKeyboardShortcuts({
  date,
  view,
  _setDate,
  setView,
  setSelectedEvent,
  setQuickCreateStartTime,
  setEventDialogOpen,
  handleTodayClick,
  handlePrevious,
  handleNext,
  defaultView,
  enableShortcuts,
}: UseKeyboardShortcutsOptions) {
  useLanguage()

  useEffect(() => {
    if (!enableShortcuts) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return
      }

      switch (e.key) {
        case 'n':
        case 'N':
          e.preventDefault()
          setSelectedEvent(null)
          setQuickCreateStartTime(new Date())
          setEventDialogOpen(true)
          break
        case '/': {
          e.preventDefault()

          const searchInput = document.querySelector(
            'input[placeholder="Search events"]',
          ) as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
          }
          break
        }
        case 't':
        case 'T':
          e.preventDefault()
          handleTodayClick()
          break
        case '1':
          e.preventDefault()
          setView('day')
          break
        case '2':
          e.preventDefault()
          setView('week')
          break
        case '3':
          e.preventDefault()
          setView('month')
          break
        case '4':
          e.preventDefault()
          setView('year')
          break
        case '5':
          e.preventDefault()
          setView('four-day')
          break
        case 'ArrowRight':
          e.preventDefault()
          handleNext()
          break
        case 'ArrowLeft':
          e.preventDefault()
          handlePrevious()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    setSelectedEvent,
    setQuickCreateStartTime,
    setEventDialogOpen,
    setView,
    date,
    view,
    defaultView,
    enableShortcuts,
  ])
}
