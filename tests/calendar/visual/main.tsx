import { createRoot } from 'react-dom/client'
import { SWRConfig } from 'swr'
import { ThemeProvider } from 'next-themes'
import { LANGUAGE_STORAGE_KEY } from '@zntr/i18n/calendar'
import { CalendarHostProvider, type CalendarHost } from '@zntr/calendar-host'
import { CalendarDataHost } from '@zntr/calendar-ui/components/providers/calendar-data-host'
import { CalendarProvider } from '@zntr/calendar-ui/components/providers/calendar-context'
import Home from '@/app/(app)/app/page'
import '@/app/globals.css'

localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
const params = new URLSearchParams(location.search)

const user = {
  id: 'visual-user',
  name: 'Demo Calendar',
  email: 'demo@example.invalid',
}
const host: CalendarHost = {
  session: { data: { user }, isPending: false },
  navigation: { push() {}, replace() {}, openExternal() {} },
  request: async (input) => {
    const url = new URL(String(input), window.location.origin)
    const responses: Record<string, unknown> = {
      '/api/app-bootstrap': { ok: true },
      '/api/account/onboarding-complete': { onboardingCompleted: true },
      '/api/settings': {
        settings: {
          language: 'en',
          timezone: 'UTC',
          defaultView: params.get('view') === 'month' ? 'month' : 'week',
          theme: 'light',
        },
      },
      '/api/categories': { categories: [] },
      '/api/countdowns': { countdowns: [] },
      '/api/bookmarks': { bookmarks: [] },
      '/api/events': {
        events: params.has('events')
          ? [
              {
                id: 'visual-planning',
                title: 'Weekly planning',
                startDate: '2026-10-05T09:00:00Z',
                endDate: '2026-10-05T10:00:00Z',
                type: 'event',
                color: 'bg-blue-500',
                allDay: false,
              },
              {
                id: 'visual-review',
                title: 'Design review',
                startDate: '2026-10-07T14:00:00Z',
                endDate: '2026-10-07T15:00:00Z',
                type: 'event',
                color: 'bg-green-500',
                allDay: false,
              },
            ]
          : [],
      },
    }
    if (!(url.pathname in responses)) {
      throw new Error(`Unexpected baseline request: ${url.pathname}`)
    }
    return Response.json(responses[url.pathname])
  },
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider attribute="class" forcedTheme="light">
    <SWRConfig value={{ provider: () => new Map(), revalidateOnFocus: false }}>
      <CalendarHostProvider value={host}>
        <CalendarDataHost>
          <CalendarProvider>
            <Home />
          </CalendarProvider>
        </CalendarDataHost>
      </CalendarHostProvider>
    </SWRConfig>
  </ThemeProvider>,
)
