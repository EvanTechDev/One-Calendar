import type { ReactNode } from 'react'
import type { Viewport } from 'next'
import { DataProvider } from '@/components/providers/data-provider'
import { CalendarProvider } from '@/components/providers/calendar-context'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function AppPageLayout({ children }: { children: ReactNode }) {
  // DataProvider and CalendarProvider stay scoped to the signed-in calendar
  // app — public pages (landing, share, privacy, …) mount outside them and
  // make zero data requests.
  return (
    <DataProvider>
      <CalendarProvider>{children}</CalendarProvider>
    </DataProvider>
  )
}
