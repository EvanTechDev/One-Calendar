'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Video, Keyboard, Lock } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { Label } from '@zntr/ui/label'
import { Switch } from '@zntr/ui/switch'
import {
  encodePassphrase,
  generatePassphrase,
  generateRoomId,
} from '@/lib/meet-utils'

/** Extracts a room id from raw input — accepts codes or full room URLs. */
export function parseRoomInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/\/rooms\/([^/]+)/)
    return match ? match[1] : null
  } catch {
    return /^[\w-]+$/.test(trimmed) ? trimmed : null
  }
}

export function HomeActions() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [e2ee, setE2ee] = useState(false)

  const startMeeting = () => {
    const roomId = generateRoomId()
    const hash = e2ee ? `#${encodePassphrase(generatePassphrase())}` : ''
    router.push(`/rooms/${roomId}${hash}`)
  }

  const joinMeeting = () => {
    const roomId = parseRoomInput(joinCode)
    if (roomId) router.push(`/rooms/${roomId}`)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button className="w-full" size="lg" onClick={startMeeting}>
          <Video className="size-4" />
          Start an instant meeting
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
