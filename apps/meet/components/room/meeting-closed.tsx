'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarX, Lock, RotateCcw } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { toast } from 'sonner'
import { getCreatorToken } from '@/lib/creator-token'

type Reason = 'missing' | 'ended' | 'expired'

const COPY: Record<Reason, { title: string; body: string }> = {
  missing: {
    title: 'This meeting does not exist',
    body: 'Check the code or ask the organiser for a new link.',
  },
  ended: {
    title: 'This meeting has ended',
    body: 'The organiser closed it. The link works again if they reopen it.',
  },
  expired: {
    title: 'This link has expired',
    body: 'Guest meetings stay open for seven days. Start a new one instead.',
  },
}

export function MeetingClosed({
  code,
  reason,
  canReopen = false,
}: {
  code: string
  reason: Reason
  canReopen?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const copy = COPY[reason]

  // A guest Organiser proves authority with the Creator Token they hold.
  const guestToken = reason === 'ended' ? getCreatorToken(code) : undefined
  const showReopen = canReopen || Boolean(guestToken)

  const reopen = async () => {
    setBusy(true)
    try {
      const response = await fetch(`/api/meetings/${code}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reopen: true, creatorToken: guestToken }),
      })
      if (!response.ok) throw new Error('Reopen failed')
      router.refresh()
    } catch {
      toast.error('Could not reopen this meeting')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          {reason === 'expired' ? (
            <CalendarX className="size-5 text-muted-foreground" />
          ) : (
            <Lock className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
          <p className="font-mono text-xs text-muted-foreground">{code}</p>
        </div>
        <div className="flex flex-col gap-2">
          {showReopen ? (
            <Button onClick={reopen} disabled={busy}>
              <RotateCcw className="size-4" />
              {busy ? 'Reopening…' : 'Reopen meeting'}
            </Button>
          ) : null}
          <Button asChild variant={showReopen ? 'outline' : 'default'}>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
