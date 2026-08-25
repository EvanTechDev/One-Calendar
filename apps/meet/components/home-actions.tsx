'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Video, Keyboard, Lock } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { Label } from '@zntr/ui/label'
import { Switch } from '@zntr/ui/switch'
import { useStartMeeting } from '@/hooks/use-start-meeting'
import { invitePartsFrom, parseRoomInput } from '@/lib/room-code'

/**
 * Start-an-instant-meeting, the E2EE choice, and join-by-code.
 *
 * One implementation, two hosts: the guest page renders it inline (a guest has
 * no sidebar, so there is nowhere else to put it) and the signed-in shell
 * renders it inside the New meeting dialog. A second copy would inevitably
 * lose the Creator Token store or the invite-hash forwarding in one of them,
 * and both are authority/encryption-critical (ADR 0016, and the E2EE
 * passphrase lives in the URL hash).
 */
export function HomeActions({
  /** Called after a successful navigation begins, so a host dialog can close. */
  onNavigate,
  idPrefix = 'home',
}: {
  onNavigate?: () => void
  /** Distinguishes the switch's label target when two copies are mounted. */
  idPrefix?: string
} = {}) {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [e2ee, setE2ee] = useState(false)
  const { start, starting } = useStartMeeting()
  const e2eeId = `${idPrefix}-e2ee-switch`

  const joinMeeting = () => {
    const roomId = parseRoomInput(joinCode)
    if (!roomId) return
    const { search, hash } = invitePartsFrom(joinCode)
    router.push(`/${roomId}${search}${hash}`)
    onNavigate?.()
  }

  const startMeeting = async () => {
    await start({ e2ee })
    onNavigate?.()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          className="w-full"
          size="lg"
          onClick={startMeeting}
          disabled={starting}
        >
          <Video className="size-4" />
          {starting ? 'Starting…' : 'Start an instant meeting'}
        </Button>
        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            <Label htmlFor={e2eeId} className="text-sm font-normal">
              End-to-end encryption
            </Label>
          </div>
          <Switch id={e2eeId} checked={e2ee} onCheckedChange={setE2ee} />
        </div>
        {/* Retention follows encryption, and both are declared up front
            (ADR 0020) — the join surface repeats it, but the choice is made
            here. */}
        <p className="text-xs text-muted-foreground">
          {e2ee
            ? 'Encrypted — chat is not saved, and the link carries the key.'
            : 'Chat is saved to this meeting’s history.'}
        </p>
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
