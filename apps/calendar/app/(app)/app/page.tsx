'use client'
import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth/client'
import Calendar from '@/components/app/calendar'
import AuthWaitingLoading from '@/components/app/auth-waiting-loading'
import { WelcomeDialog } from '@/components/welcome/welcome-dialog'

export default function Home() {
  const { data: session, isPending, refetch } = authClient.useSession()
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
      const onboardingCompleted = (session.user as Record<string, unknown>)
        .onboardingCompleted as boolean | undefined
      if (!onboardingCompleted) {
        setShowWelcome(true)
      }
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
          void refetch()
        }}
      />
      <Calendar />
    </>
  )
}
