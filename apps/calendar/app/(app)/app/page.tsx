'use client'
import Calendar from '@/components/app/calendar'
import AuthWaitingLoading from '@/components/app/auth-waiting-loading'
import { useEffect, useState } from 'react'

export default function Home() {
  const [ready, setReady] = useState(false)

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

  if (!ready) {
    return <AuthWaitingLoading />
  }
  return <Calendar />
}
