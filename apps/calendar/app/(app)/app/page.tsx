'use client'
import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth/client'
import Calendar from '@/components/app/calendar'
import AuthWaitingLoading from '@/components/app/auth-waiting-loading'
import { WelcomeDialog } from '@/components/welcome/welcome-dialog'

export default function Home() {
  const { data: session, isPending } = authClient.useSession()
  const [ready, setReady] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)

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

  if (!ready || isPending) {
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
                  window.dispatchEvent(new CustomEvent('languagechange', { detail: { language: s.language } }))
                }
                if (s.timezone) {
                  window.dispatchEvent(new CustomEvent('timezonechange', { detail: { timezone: s.timezone } }))
                }
                if (s.firstDayOfWeek !== undefined) {
                  window.dispatchEvent(new CustomEvent('firstdaychange', { detail: { firstDay: s.firstDayOfWeek } }))
                }
                if (s.defaultView) {
                  window.dispatchEvent(new CustomEvent('viewchange', { detail: { view: s.defaultView } }))
                }
                if (s.timeFormat) {
                  window.dispatchEvent(new CustomEvent('timeformatchange', { detail: { format: s.timeFormat } }))
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
