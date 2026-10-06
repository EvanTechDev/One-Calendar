import type { ReactNode } from 'react'
import type { Viewport } from 'next'
import { CalendarDataHost } from '@zntr/calendar-ui/components/providers/calendar-data-host'
import { CalendarProvider } from '@zntr/calendar-ui/components/providers/calendar-context'
import { requireAppSession } from '@/lib/auth/require-session'
import { CalendarWebHost } from '@/components/providers/calendar-web-host'

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
    <CalendarWebHost>
      <CalendarDataHost>
        <CalendarProvider>{children}</CalendarProvider>
      </CalendarDataHost>
    </CalendarWebHost>
  )
}
