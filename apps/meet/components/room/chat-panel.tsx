'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { cn } from '@zntr/utils'
import type { RoomChat } from '@/hooks/use-room-chat'

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
  /**
   * Owned by the room, not by this panel: `useChat` accumulates history in its
   * own state, so mounting it here meant closing the panel threw the history
   * away along with anything that arrived while it was shut.
   */
  chat: RoomChat
  /**
   * Encrypted rooms never retain chat — the server would only ever see
   * ciphertext, and pretending otherwise would weaken the E2EE promise
   * (ADR 0020). Shown to the viewer so the difference is not a secret.
   */
  retainMessages: boolean
}

export function ChatPanel({ onClose, chat, retainMessages }: ChatPanelProps) {
  const { messages, send } = chat
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length])

  const sendMessage = async () => {
    const message = draft.trim()
    if (!message) return
    // Cleared only once the message is actually out, so a failed send never
    // silently swallows what the user typed.
    if (await send(message)) setDraft('')
  }

  return (
    // A fixed 320px panel beside the stage leaves 40px of video on a 360px
    // phone, so below `sm` it overlays the stage instead of splitting it.
    <aside className="absolute inset-0 z-20 flex flex-col border-l bg-background sm:relative sm:inset-auto sm:z-auto sm:w-80 sm:shrink-0">
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
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet
          </p>
        ) : (
          messages.map((message) => {
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
