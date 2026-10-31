'use client'

import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@zntr/ui/button'

/**
 * Terminal screen for a meeting that could not be joined or was dropped.
 * Without it a failure left the user staring at an empty room with no way
 * out but the browser's back button.
 */
export function RoomFailure({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <AlertTriangle className="size-5 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Meeting unavailable</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex flex-col gap-2">
          {onRetry ? (
            <Button onClick={onRetry}>
              <RotateCcw className="size-4" />
              Rejoin
            </Button>
          ) : null}
          <Button asChild variant={onRetry ? 'outline' : 'default'}>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
