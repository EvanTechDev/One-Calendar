'use client'

import { useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardPaste, Keyboard } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { invitePartsFrom, parseRoomInput } from '@/lib/room-code'

/** Shared by home, the guest page and the New meeting dialog. */
export function JoinMeetingForm({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const [pasteError, setPasteError] = useState(false)
  const [pasting, setPasting] = useState(false)
  const roomId = parseRoomInput(value)
  const invalid = touched && value.trim().length > 0 && !roomId

  const paste = async () => {
    setPasting(true)
    setPasteError(false)
    try {
      setValue(await navigator.clipboard.readText())
      setTouched(true)
    } catch {
      setPasteError(true)
    } finally {
      setPasting(false)
      inputRef.current?.focus()
    }
  }

  return (
    <form
      className="space-y-2"
      aria-label="Join a meeting"
      onSubmit={(event) => {
        event.preventDefault()
        if (!roomId) return
        // Invite hashes contain the E2EE key; never rebuild a pasted link
        // from its room code alone.
        const { search, hash } = invitePartsFrom(value)
        router.push(`/${roomId}${search}${hash}`)
        onNavigate?.()
      }}
    >
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Keyboard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setPasteError(false)
            }}
            onBlur={() => setTouched(true)}
            placeholder="Enter a code or link"
            className="h-11 pl-9 pr-12"
            aria-label="Meeting code or link"
            aria-describedby={hintId}
            aria-invalid={invalid}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 size-11"
            onClick={paste}
            disabled={pasting}
            aria-label="Paste meeting link"
            title="Paste from clipboard"
          >
            <ClipboardPaste className="size-4" />
          </Button>
        </div>
        <Button
          type="submit"
          variant="secondary"
          className="h-11 px-4"
          disabled={!roomId || pasting}
        >
          Join
        </Button>
      </div>
      <p
        id={hintId}
        className="text-xs text-muted-foreground"
        aria-live="polite"
      >
        {pasteError
          ? 'Clipboard unavailable. Paste the link into the field instead.'
          : invalid
            ? 'Use a meeting code like ab3k-x9q2 or a full invite link.'
            : 'Have an invite? Paste the link or enter its meeting code.'}
      </p>
    </form>
  )
}
