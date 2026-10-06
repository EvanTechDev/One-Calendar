'use client'

import { useMemo, type ReactNode } from 'react'
import { useCalendarHost } from '@zntr/calendar-host'
import { createCalendarApi } from '@/lib/api-client'
import { DataProvider } from './data-provider'

export function CalendarDataHost({ children }: { children: ReactNode }) {
  const { request } = useCalendarHost()
  const api = useMemo(() => createCalendarApi(request), [request])

  return <DataProvider api={api}>{children}</DataProvider>
}
