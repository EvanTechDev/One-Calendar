'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CircleAlert, LoaderCircle } from 'lucide-react'
import { buttonVariants } from '@zntr/ui/button'

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
    <main className="flex min-h-dvh flex-col bg-background px-6 py-8 sm:px-12">
      <Link
        href="/app"
        className="flex w-fit items-center gap-3 text-sm font-medium"
      >
        <img src="/icon.svg" alt="" width={28} height={28} />
        Zentra Calendar
      </Link>
      <section
        className="m-auto w-full max-w-md py-16"
        aria-labelledby="continue-title"
      >
        <div className="mb-8 flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
          {error ? (
            <CircleAlert
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <LoaderCircle
              className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
        </div>
        <h1
          id="continue-title"
          className="text-3xl font-semibold tracking-tight"
        >
          {error ? 'Let’s open that page again' : 'A moment, and you’re there'}
        </h1>
        {error ? (
          <div
            role="alert"
            className="mt-5 space-y-3 text-sm leading-relaxed text-muted-foreground"
          >
            <p>{error}</p>
            <p>
              Return to Zentra on your desktop and open the page again to get a
              new link.
            </p>
          </div>
        ) : (
          <p
            role="status"
            className="mt-5 text-sm leading-relaxed text-muted-foreground"
          >
            Connecting your desktop session to this browser…
          </p>
        )}
        {error ? (
          <Link
            href="/app"
            className={`${buttonVariants({ variant: 'outline' })} mt-8`}
          >
            Go to calendar
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </section>
      <p className="text-xs text-muted-foreground">
        Zentra for desktop · Continue in your browser
      </p>
    </main>
  )
}
