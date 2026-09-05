'use client'

/**
 * The AI command palette: a cmdk (shadcn Command) dialog whose first row is
 * a free-text ask box. Type a question, press Enter, and the calendar
 * copilot answers in place — listing, creating, moving or analyzing events
 * through the same user-scoped tool layer the MCP server uses.
 *
 * Deliberately NOT a chat page: the palette keeps one running conversation
 * per open session so follow-ups work ("move it an hour later"), but the
 * transcript dies with the dialog. Ctrl/Cmd+K opens it anywhere in the app.
 */
import * as React from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { CommandDialog, CommandInput, CommandList } from '@zntr/ui/command'
import { Kbd } from '@zntr/ui/kbd'
import { Spinner } from '@zntr/ui/spinner'
import { cn } from '@zntr/utils'
import {
  CalendarPlus,
  CalendarSearch,
  ChartNoAxesColumn,
  Clock,
  CornerDownLeft,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react'
import { translations, useLanguage } from '@zntr/i18n/calendar'

const TOOL_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  'tool-list_events': CalendarSearch,
  'tool-create_event': CalendarPlus,
  'tool-update_event': Wrench,
  'tool-delete_event': Trash2,
  'tool-list_categories': Wrench,
  'tool-get_schedule_summary': ChartNoAxesColumn,
  'tool-find_free_time': Clock,
}

function toolLabel(type: string): string {
  return type.replace(/^tool-/, '').replaceAll('_', ' ')
}

interface AiCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Called after any assistant turn that ran a write tool, so the calendar
   * view refetches and shows what the agent just did.
   */
  onEventsMutated?: () => void
}

const WRITE_TOOLS = new Set([
  'tool-create_event',
  'tool-update_event',
  'tool-delete_event',
])

export function AiCommandPalette({
  open,
  onOpenChange,
  onEventsMutated,
}: AiCommandPaletteProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const [input, setInput] = React.useState('')

  const { messages, sendMessage, status, error, setMessages, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/agent/chat' }),
  })

  const busy = status === 'submitted' || status === 'streaming'

  // Refresh the calendar after a completed turn that wrote something.
  const lastNotified = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (status !== 'ready') return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant' || last.id === lastNotified.current)
      return
    const wrote = last.parts?.some((part) => WRITE_TOOLS.has(part.type))
    if (wrote) {
      lastNotified.current = last.id
      onEventsMutated?.()
    }
  }, [status, messages, onEventsMutated])

  const listRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    // Keep the newest text on screen while streaming.
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  const ask = React.useCallback(() => {
    const text = input.trim()
    if (!text || busy) return
    void sendMessage({ text })
    setInput('')
  }, [input, busy, sendMessage])

  const reset = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen)
      if (!nextOpen) {
        void stop()
        setMessages([])
        setInput('')
        lastNotified.current = null
      }
    },
    [onOpenChange, stop, setMessages],
  )

  const hasConversation = messages.length > 0

  return (
    <CommandDialog
      open={open}
      onOpenChange={reset}
      title={t.aiAssistant}
      description={t.aiAssistantHint}
      className="top-[30%] translate-y-0 sm:max-w-xl"
      showCloseButton={false}
    >
      {/* The transcript is plain content, not CommandItems, so cmdk's
          filtering never applies to it — the input is a question box. */}
      <CommandInput
        placeholder={t.aiAssistantPlaceholder}
        value={input}
        onValueChange={setInput}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            ask()
          }
        }}
      />
      <CommandList
        ref={listRef}
        className={cn('max-h-[420px]', !hasConversation && 'max-h-none')}
      >
        {!hasConversation && (
          <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
            <Sparkles className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t.aiAssistantHint}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <CornerDownLeft className="size-3" />
              {t.aiAssistantEnterToAsk}
            </p>
          </div>
        )}

        {hasConversation && (
          <div className="flex flex-col gap-3 px-3 py-3">
            {messages.map((message) => (
              <div key={message.id} className="flex flex-col gap-1.5">
                {message.role === 'user' ? (
                  <div className="self-end rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                    {message.parts?.map((part, i) =>
                      part.type === 'text' ? (
                        <span key={i}>{part.text}</span>
                      ) : null,
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 self-start">
                    {message.parts?.map((part, i) => {
                      if (part.type === 'text' && part.text) {
                        return (
                          <div
                            key={i}
                            className="rounded-lg bg-muted px-3 py-1.5 text-sm whitespace-pre-wrap"
                          >
                            {part.text}
                          </div>
                        )
                      }
                      if (part.type.startsWith('tool-')) {
                        const Icon = TOOL_ICONS[part.type] ?? Wrench
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground"
                          >
                            <Icon className="size-3" />
                            <span>{toolLabel(part.type)}</span>
                          </div>
                        )
                      }
                      return null
                    })}
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Spinner className="size-3" />
                {t.aiAssistantThinking}
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
                {t.aiAssistantError}
              </div>
            )}
          </div>
        )}
      </CommandList>

      <div className="flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Sparkles className="size-3" />
          {t.aiAssistant}
        </span>
        <span className="flex items-center gap-1">
          <Kbd>esc</Kbd>
          {t.close}
        </span>
      </div>
    </CommandDialog>
  )
}
