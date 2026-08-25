'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@livekit/components-react'
import { Send, X } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { toast } from 'sonner'
import { cn } from '@zntr/utils'

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/g

/** Renders plain text with clickable links. */
function LinkifiedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) parts.push(text.slice(lastIndex, index))
    parts.push(
      <a
        key={index}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-primary"
      >
        {match[0]}
      </a>,
    )
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}

interface ChatPanelProps {
  onClose: () => void
  /** The room this chat belongs to, for retention. */
  roomName: string
  /**
   * Encrypted rooms never retain chat — the server would only ever see
   * ciphertext, and pretending otherwise would weaken the E2EE promise
   * (ADR 0020).
   */
  retainMessages: boolean
  /**
   * The LiveKit join token, sent with each retained message as proof of room
   * membership. The endpoint reads the sender's identity out of it — a
   * client-supplied identity would be trivially forgeable.
   */
  participantToken: string
}

export function ChatPanel({
  onClose,
  roomName,
  retainMessages,
  participantToken,
}: ChatPanelProps) {
  const { chatMessages, send } = useChat()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [chatMessages.length])

  const sendMessage = async () => {
    const message = draft.trim()
    if (!message) return
    try {
      await send(message)
      // Cleared only once the message is actually out, so a failed send
      // never silently swallows what the user typed.
      setDraft('')
      if (retainMessages) {
        // Best-effort: the live message already went through, so a failed
        // retention post must not surface as a send failure.
        void fetch(`/api/meetings/${roomName}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Identity is derived server-side from this token's claims, so it is
          // deliberately NOT sent alongside it.
          body: JSON.stringify({ message, participantToken }),
        }).catch(() => {})
      }
    } catch {
      toast.error('Message failed to send')
    }
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-medium">Chat</h2>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={onClose}
          aria-label="Close chat"
        >
          <X className="size-4" />
        </Button>
      </div>
      <p className="border-b px-4 py-2 text-xs text-muted-foreground">
        {retainMessages
          ? 'Messages are saved to this meeting’s history'
          : 'Encrypted meeting — messages are not saved'}
      </p>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {chatMessages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet
          </p>
        ) : (
          chatMessages.map((message) => {
            const isLocal = message.from?.isLocal ?? false
            return (
              <div
                key={message.id}
                className={cn('flex flex-col', isLocal && 'items-end')}
              >
                <span className="mb-0.5 text-xs text-muted-foreground">
                  {isLocal
                    ? 'You'
                    : message.from?.name || message.from?.identity}
                </span>
                <div
                  className={cn(
                    'max-w-[85%] break-words rounded-lg px-3 py-2 text-sm',
                    isLocal ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  <LinkifiedText text={message.message} />
                </div>
              </div>
            )
          })
        )}
      </div>
      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault()
          sendMessage()
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Send a message"
          aria-label="Chat message"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!draft.trim()}
          aria-label="Send message"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </aside>
  )
}
