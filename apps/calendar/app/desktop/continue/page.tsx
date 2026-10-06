'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function DesktopContinue() {
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (started.current) return
    started.current = true
    const token = window.location.hash.slice(1)
    window.history.replaceState(null, '', window.location.pathname)
    void fetch('/api/auth/desktop/browser-continue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok)
          throw new Error(result.message ?? 'Could not open this page.')
        window.location.replace(result.destination)
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not connect to Zentra.',
        ),
      )
  }, [])
  return (
    <main className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-xl font-semibold">Zentra Calendar</h1>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <p>Open this page again from the desktop app.</p>
          <Link href="/app">Continue to calendar</Link>
        </>
      ) : (
        <p role="status">Opening your page…</p>
      )}
    </main>
  )
}
