'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Video, Keyboard, Lock } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { Label } from '@zntr/ui/label'
import { Switch } from '@zntr/ui/switch'
import { useStartMeeting } from '@/hooks/use-start-meeting'

const ROOM_CODE_PATTERN = /^[a-z0-9]{4}-[a-z0-9]{4}$/

/**
 * Extracts a room code from raw input — a bare code, a root-path link
 * (`/ab3k-x9q2`), or a legacy `/rooms/<code>` link.
 */
export function parseRoomInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    const legacy = url.pathname.match(/\/rooms\/([^/]+)/)
    const candidate = legacy
      ? legacy[1]
      : url.pathname.replace(/^\/+|\/+$/g, '')
    return ROOM_CODE_PATTERN.test(candidate) ? candidate : null
  } catch {
    return ROOM_CODE_PATTERN.test(trimmed) ? trimmed : null
  }
}

/**
 * The search and hash of a pasted invite link must survive the jump into
 * the room: the hash carries the E2EE passphrase, and dropping it lands the
 * user in an encrypted room without the key.
 */
function invitePartsFrom(value: string): { search: string; hash: string } {
  try {
    const url = new URL(value.trim())
    return { search: url.search, hash: url.hash }
  } catch {
    return { search: '', hash: '' }
  }
}

export function HomeActions() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [e2ee, setE2ee] = useState(false)
  const { start, starting } = useStartMeeting()

  const joinMeeting = () => {
    const roomId = parseRoomInput(joinCode)
    if (!roomId) return
    const { search, hash } = invitePartsFrom(joinCode)
    router.push(`/${roomId}${search}${hash}`)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          className="w-full"
          size="lg"
          onClick={() => start({ e2ee })}
          disabled={starting}
        >
          <Video className="size-4" />
          {starting ? 'Starting…' : 'Start an instant meeting'}
        </Button>
        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            <Label htmlFor="e2ee-switch" className="text-sm font-normal">
              End-to-end encryption
            </Label>
          </div>
          <Switch id="e2ee-switch" checked={e2ee} onCheckedChange={setE2ee} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          joinMeeting()
        }}
      >
        <div className="relative flex-1">
          <Keyboard className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="Enter a code or link"
            className="pl-9"
            aria-label="Meeting code or link"
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={!parseRoomInput(joinCode)}
        >
          Join
        </Button>
      </form>
    </div>
  )
}
