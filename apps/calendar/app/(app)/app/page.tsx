'use client'
import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth/client'
import Calendar, { CALENDAR_VIEW_CHUNKS } from '@/components/app/calendar'
import { useSettings } from '@/components/providers/data-provider'
import { isCalendarView } from '@/lib/calendar-types'
import AuthWaitingLoading from '@/components/app/auth-waiting-loading'
import { WelcomeDialog } from '@/components/welcome/welcome-dialog'

export default function Home() {
  const { data: session, isPending } = authClient.useSession()
  const { settings, loading: dataLoading } = useSettings()
  const [ready, setReady] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [viewChunkReady, setViewChunkReady] = useState(false)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        await fetch('/api/app-bootstrap', { cache: 'no-store' })
      } catch {
        // still let the user through
      }
      if (active) setReady(true)
    }
    void run()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (ready && !isPending && session?.user) {
      void fetch('/api/account/onboarding-complete')
        .then((res) => res.json())
        .then((data) => {
          if (!data.onboardingCompleted) {
            setShowWelcome(true)
          }
        })
        .catch(() => {})
    }
  }, [ready, isPending, session])

  /**
   * One loading screen for the whole of start-up, not one per stage.
   *
   * The calendar used to run its own gate on the settings fetch and paint
   * `AuthWaitingLoading` a second time, so entering the app flashed the logo
   * twice with the real app in between. Deleting that gate instead is not an
   * option: it is the only thing on screen while the views' chunks are in
   * flight, and those render `null` until they land — the middle column came
   * up black.
   *
   * So the waits are hoisted here instead, and the calendar only mounts once
   * the data has settled and its view chunk is in the module cache. The
   * calendar keeps its own gate for any other caller; its state is seeded from
   * the same loading flag, so on this route it is already open at mount.
   */
  useEffect(() => {
    if (dataLoading === 'loading') return

    const saved = settings.defaultView
    const view =
      typeof saved === 'string' && isCalendarView(saved) ? saved : 'week'
    let active = true
    void CALENDAR_VIEW_CHUNKS[view]().then(() => {
      if (active) setViewChunkReady(true)
    })

    return () => {
      active = false
    }
  }, [dataLoading, settings.defaultView])

  // A latch, not a live condition. Every one of these waits only resolves
  // once, so deriving the gate from them would be equivalent — until one of
  // them reports busy again mid-session and drops the whole app back to the
  // loading screen. The screen is for start-up; after that the app is up.
  const starting =
    !ready || isPending || dataLoading === 'loading' || !viewChunkReady

  useEffect(() => {
    if (!starting) setStarted(true)
  }, [starting])

  if (!started) {
    return <AuthWaitingLoading />
  }

  return (
    <>
      <WelcomeDialog
        open={showWelcome}
        onOpenChange={setShowWelcome}
        onComplete={() => {
          setShowWelcome(false)
          void fetch('/api/account/onboarding-complete')
            .then((res) => res.json())
            .then((data) => {
              if (data.settings) {
                const s = data.settings
                if (s.language) {
                  window.dispatchEvent(
                    new CustomEvent('languagechange', {
                      detail: { language: s.language },
                    }),
                  )
                }
                if (s.timezone) {
                  window.dispatchEvent(
                    new CustomEvent('timezonechange', {
                      detail: { timezone: s.timezone },
                    }),
                  )
                }
                if (s.firstDayOfWeek !== undefined) {
                  window.dispatchEvent(
                    new CustomEvent('firstdaychange', {
                      detail: { firstDay: s.firstDayOfWeek },
                    }),
                  )
                }
                if (s.defaultView) {
                  window.dispatchEvent(
                    new CustomEvent('viewchange', {
                      detail: { view: s.defaultView },
                    }),
                  )
                }
                if (s.timeFormat) {
                  window.dispatchEvent(
                    new CustomEvent('timeformatchange', {
                      detail: { format: s.timeFormat },
                    }),
                  )
                }
              }
            })
            .catch(() => {})
        }}
      />
      <Calendar />
    </>
  )
}
