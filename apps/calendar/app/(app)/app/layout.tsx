import type { ReactNode } from 'react'
import type { Viewport } from 'next'
import { DataProvider } from '@/components/providers/data-provider'
import { CalendarProvider } from '@/components/providers/calendar-context'
import { requireAppSession } from '@/lib/auth/require-session'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default async function AppPageLayout({
  children,
}: {
  children: ReactNode
}) {
  // The guard lives here rather than in the page so it runs before any provider
  // mounts. There was none at all: a signed-out visitor kept the whole app shell
  // and every refresh kept them there, because the page only ever *read* the
  // session and rendered regardless.
  await requireAppSession()

  // DataProvider and CalendarProvider stay scoped to the signed-in calendar
  // app — public pages (landing, share, privacy, …) mount outside them and
  // make zero data requests.
  return (
    <DataProvider>
      <CalendarProvider>{children}</CalendarProvider>
    </DataProvider>
  )
}
