'use client'

import { useEffect, useMemo, type ReactNode } from 'react'
import { useSWRConfig } from 'swr'
import { useCalendarHost } from '@zntr/utils/calendar-host'
import { createCalendarApi } from '#calendar/lib/api-client'
import { DataProvider } from './data-provider'

export function CalendarDataHost({ children }: { children: ReactNode }) {
  const { request } = useCalendarHost()
  const api = useMemo(() => createCalendarApi(request), [request])
  const { mutate } = useSWRConfig()
  useEffect(() => {
    const refresh = () => {
      void mutate(() => true)
    }
    window.addEventListener('zentra-reconnected', refresh)
    return () => window.removeEventListener('zentra-reconnected', refresh)
  }, [mutate])

  return <DataProvider api={api}>{children}</DataProvider>
}
