'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { cn } from '@zntr/utils'
import { groupChatMessages } from '@/lib/chat-grouping'
import type { ChatGroup } from '@/lib/chat-grouping'
import type { RoomChat } from '@/hooks/use-room-chat'

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/g

/** Renders plain text with clickable links. */
/**
 * One sender's consecutive run.
 *
 * Remote messages are a name + text block rather than a bubble, matching Google
 * Meet (ADR 0018 makes Google the baseline where no decision says otherwise).
 * Two reasons beyond parity: a bubble on a 320px panel spends 24px of the
 * width on padding it does not need, and in a two-party call every second
 * bubble being grey is noise — who spoke is already on the header line.
 *
 * The local side keeps its bubble, because that is the only thing
 * distinguishing "mine" from "theirs" once the remote side has none.
 */
function ChatGroupBlock({ group }: { group: ChatGroup }) {
  return (
    // `items-start` / `items-end`, never the default `stretch`. That default
    // was the actual reported bug: a stretched flex child fills the line, so
    // `max-w-[85%]` acted as an exact width and a one-word remote reply
    // rendered a 272px slab. Both alignments make the child hug its text.
    <div
      className={cn(
        'flex flex-col',
        group.isLocal ? 'items-end' : 'items-start',
      )}
    >
      {/* Sender and time share one line, and only the first message of a run
          gets one — that is what keeps a timestamp from costing a line each. */}
      <p
        className={cn(
          'mb-1 flex max-w-full items-baseline gap-1.5 px-0.5 text-xs leading-none text-muted-foreground',
          group.isLocal && 'flex-row-reverse',
        )}
      >
        <span className="min-w-0 truncate font-medium text-foreground/80">
          {group.senderName}
        </span>
        <time
          className="shrink-0 tabular-nums"
          dateTime={new Date(group.timestamp).toISOString()}
        >
          {formatTime(group.timestamp)}
        </time>
      </p>
      <div
        className={cn(
          'flex w-full flex-col gap-1',
          group.isLocal ? 'items-end' : 'items-start',
        )}
      >
        {group.messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              // `break-words` alone does not break a 60-character URL, which
              // is exactly the message that overflows a 320px panel.
              'max-w-[calc(100%-1.5rem)] break-words text-sm [overflow-wrap:anywhere]',
              group.isLocal
                ? 'rounded-2xl bg-primary px-2.5 py-1.5 text-primary-foreground'
                : 'px-0.5 text-foreground',
            )}
          >
            <LinkifiedText text={message.message} />
          </div>
        ))}
      </div>
    </div>
  )
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

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
  const groups = useMemo(() => groupChatMessages(messages), [messages])

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
      {/* `space-y-3` between senders, not between messages: a run from one
          person is one block, so its own messages sit closer together. */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-3 py-4"
      >
        {groups.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet
          </p>
        ) : (
          groups.map((group) => (
            <ChatGroupBlock key={group.key} group={group} />
          ))
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
