'use client'

/**
 * The command palette (Cmd/Ctrl+K): quick actions first, AI second.
 *
 * Two modes, one input.
 *  - Palette mode: cmdk filters a list of app commands (navigate views,
 *    create event, open settings). "Ask AI" is always the first item so
 *    Enter on any free-form question routes to it.
 *  - Chat mode: entered on the first question. The list becomes a streaming
 *    transcript rendered through MessageScroller, which owns the scroll UX
 *    rules: follow only at the live edge, any reader interaction detaches,
 *    new turns anchor at the reader's prompt, jump-to-latest returns.
 *
 * Markdown: assistant text renders through Streamdown (streaming-tolerant
 * markdown, so half-written fences and emphasis do not flash).
 */
import * as React from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ChatTranscript } from './chat-transcript'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@zntr/ui/command'
import { Kbd } from '@zntr/ui/kbd'
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChartNoAxesColumn,
  Columns4,
  Grid3x3,
  Rows3,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react'
import { translations, useLanguage } from '@zntr/i18n/calendar'

const WRITE_TOOLS = new Set([
  'tool-create_event',
  'tool-update_event',
  'tool-delete_event',
])

export interface PaletteActions {
  setView: (view: 'day' | 'week' | 'month' | 'year' | 'four-day') => void
  goToToday: () => void
  createEvent: () => void
  openAnalytics: () => void
  openSettings: () => void
}

interface AiCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Called after any assistant turn that ran a write tool, so the calendar
   * view refetches and shows what the agent just did.
   */
  onEventsMutated?: () => void
  /** App commands surfaced as palette items alongside the AI. */
  actions?: PaletteActions
}

export function AiCommandPalette({
  open,
  onOpenChange,
  onEventsMutated,
  actions,
}: AiCommandPaletteProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const [input, setInput] = React.useState('')
  const [mode, setMode] = React.useState<'palette' | 'chat'>('palette')

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

  const ask = React.useCallback(() => {
    const text = input.trim()
    if (!text || busy) return
    setMode('chat')
    void sendMessage({ text })
    setInput('')
  }, [input, busy, sendMessage])

  const runAction = React.useCallback(
    (fn?: () => void) => {
      onOpenChange(false)
      fn?.()
    },
    [onOpenChange],
  )

  const backToPalette = React.useCallback(() => {
    void stop()
    setMessages([])
    setMode('palette')
    lastNotified.current = null
  }, [stop, setMessages])

  const reset = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen)
      if (!nextOpen) {
        void stop()
        setMessages([])
        setMode('palette')
        setInput('')
        lastNotified.current = null
      }
    },
    [onOpenChange, stop, setMessages],
  )

  const inChat = mode === 'chat'

  return (
    <CommandDialog
      open={open}
      onOpenChange={reset}
      title={t.aiAssistant}
      description={t.aiAssistantHint}
      className="sm:max-w-xl"
    >
      {/* The new CommandDialog renders children bare (no implicit Command
          root), so cmdk's context is established here explicitly. */}
      <Command className="rounded-xl!">
        <CommandInput
          placeholder={
            inChat ? t.aiAssistantPlaceholder : t.aiPalettePlaceholder
          }
          value={input}
          onValueChange={setInput}
          onKeyDown={(e) => {
            // In palette mode cmdk's own Enter selects the highlighted item
            // (including "Ask AI"); only intercept while chatting.
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && inChat) {
              e.preventDefault()
              ask()
            }
            // Backspace on an empty input leaves the conversation, mirroring
            // cmdk's page convention.
            if (e.key === 'Backspace' && inChat && input === '') {
              backToPalette()
            }
          }}
        />

        {inChat ? (
          <ChatTranscript
            t={t}
            messages={messages}
            busy={busy}
            error={error ?? null}
          />
        ) : (
          <CommandList>
            <CommandEmpty>{t.noMatchingEvents}</CommandEmpty>
            <CommandGroup heading={t.aiAssistant}>
              {/* value tracks the raw input so this item matches whatever the
                user typed — any free-form question routes to the AI. */}
              <CommandItem
                value={input.length > 0 ? input : t.aiAssistant}
                onSelect={ask}
                disabled={busy || input.trim().length === 0}
              >
                <Sparkles />
                <span className="truncate">
                  {input.trim().length > 0
                    ? `${t.aiAssistantAsk}: ${input}`
                    : t.aiAssistantHint}
                </span>
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            {actions && (
              <>
                <CommandSeparator />
                <CommandGroup heading={t.calendar}>
                  <CommandItem onSelect={() => runAction(actions.createEvent)}>
                    <CalendarPlus />
                    {t.createEvent}
                    <CommandShortcut>N</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => runAction(actions.goToToday)}>
                    <Sun />
                    {t.today}
                    <CommandShortcut>T</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => runAction(() => actions.setView('day'))}
                  >
                    <CalendarDays />
                    {t.day}
                    <CommandShortcut>1</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => runAction(() => actions.setView('week'))}
                  >
                    <Rows3 />
                    {t.week}
                    <CommandShortcut>2</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => runAction(() => actions.setView('month'))}
                  >
                    <Grid3x3 />
                    {t.month}
                    <CommandShortcut>3</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => runAction(() => actions.setView('year'))}
                  >
                    <CalendarRange />
                    {t.year}
                    <CommandShortcut>4</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() =>
                      runAction(() => actions.setView('four-day'))
                    }
                  >
                    <Columns4 />
                    {t.fourDay}
                    <CommandShortcut>5</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading={t.settings}>
                  <CommandItem
                    onSelect={() => runAction(actions.openAnalytics)}
                  >
                    <ChartNoAxesColumn />
                    {t.analytics}
                  </CommandItem>
                  <CommandItem onSelect={() => runAction(actions.openSettings)}>
                    <Settings />
                    {t.settings}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        )}

        <div className="flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
          {inChat ? (
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1 hover:text-foreground"
              onClick={backToPalette}
            >
              <ArrowLeft className="size-3" />
              {t.aiAssistantBack}
            </button>
          ) : (
            <span className="flex items-center gap-1">
              <Sparkles className="size-3" />
              {t.aiAssistant}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Kbd>esc</Kbd>
            {t.close}
          </span>
        </div>
      </Command>
    </CommandDialog>
  )
}
