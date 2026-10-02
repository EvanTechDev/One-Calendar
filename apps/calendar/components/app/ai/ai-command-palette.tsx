'use client'

/**
 * The command palette (Cmd/Ctrl+K): commands first, AI second, search third.
 *
 * Three modes, one input.
 *  - Palette mode: cmdk filters a list of app commands (navigate views, move
 *    between periods, jump to a date, create event, open settings). Typing a
 *    date offers a "go to" row; typing anything else offers a semantic-search
 *    row, so Enter on free text searches instead of doing nothing.
 *  - Chat mode: the full assistant, entered by picking "Ask AI" — it can
 *    create, change and delete, and destructive tools pause for confirmation.
 *  - Search mode: read-only. The route hands this mode a smaller toolset and
 *    a lookup-only prompt, so a half-remembered question can never turn into
 *    a write.
 *
 * Search is deliberately NOT the same keypress as the command palette: the
 * commands are the fast path and stay instant, and the model is only paid for
 * when the user asks a question in words.
 *
 * Heights are dvh-based: on mobile the browser's URL bar eats real
 * viewport, and a vh-sized dialog put its bottom out of reach.
 */
import * as React from 'react'
import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai'
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
import { ScrollArea } from '@zntr/ui/scroll-area'
import { Kbd } from '@zntr/ui/kbd'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CalendarSearch,
  ChartNoAxesColumn,
  Columns4,
  Grid3x3,
  LocateFixed,
  Rows3,
  Search,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { parseDateQuery } from '@/lib/parse-date-query'

/**
 * Build-time presence flag from next.config.ts — never the key itself. It
 * gates the AI rows only: the palette itself is a keyboard surface for the
 * calendar and must work on a deployment with no model configured.
 */
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === '1'

const WRITE_TOOLS = new Set([
  'tool-create_event',
  'tool-update_event',
  'tool-delete_event',
  'tool-bookmark_event',
  'tool-remove_bookmark',
  'tool-create_countdown',
  'tool-delete_countdown',
])

export interface PaletteActions {
  setView: (view: 'day' | 'week' | 'month' | 'year' | 'four-day') => void
  goToToday: () => void
  createEvent: () => void
  openAnalytics: () => void
  openSettings: () => void
  /** One period back / forward in the current view. */
  previousPeriod: () => void
  nextPeriod: () => void
  /** Jump the visible date, e.g. from the "go to" row. */
  goToDate: (date: Date) => void
  /** Put the caret in the top-bar keyword search. */
  focusSearch: () => void
}

type Mode = 'palette' | 'chat' | 'search'

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
  const [mode, setMode] = React.useState<Mode>('palette')

  const chat = useChat({
    transport: new DefaultChatTransport({ api: '/api/agent/chat' }),
    // Resume the turn automatically once every pending approval has an
    // answer — the user clicks approve/deny, the model carries on.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  })

  // A second transport, not a mode flag on the first: the two modes have
  // separate transcripts (asking the assistant to move a meeting must not
  // scroll a search conversation out of the history) and separate busy/error
  // state, and one hook per transport is what useChat gives us.
  const search = useChat({
    transport: new DefaultChatTransport({
      api: '/api/agent/chat',
      body: { mode: 'search' },
    }),
  })

  const active = mode === 'chat' ? chat : search
  const busy = active.status === 'submitted' || active.status === 'streaming'

  // Refresh the calendar after a completed turn that wrote something.
  const lastNotified = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (mode !== 'chat') return
    if (chat.status !== 'ready') return
    const last = chat.messages[chat.messages.length - 1]
    if (!last || last.role !== 'assistant' || last.id === lastNotified.current)
      return
    const wrote = last.parts?.some((part) => WRITE_TOOLS.has(part.type))
    if (wrote) {
      lastNotified.current = last.id
      onEventsMutated?.()
    }
  }, [mode, chat.status, chat.messages, onEventsMutated])

  /**
   * Enter one of the two AI modes with the text typed so far. A follow-up in
   * a mode that is already open just sends.
   */
  const enter = React.useCallback(
    (target: 'chat' | 'search') => {
      const text = input.trim()
      if (busy) return
      if (mode !== target && text) {
        setMode(target)
        setInput('')
        void (target === 'chat' ? chat : search).sendMessage({ text })
        return
      }
      if (!text) return
      void (target === 'chat' ? chat : search).sendMessage({ text })
      setInput('')
    },
    [input, busy, mode, chat, search],
  )

  const runAction = React.useCallback(
    (fn?: () => void) => {
      onOpenChange(false)
      fn?.()
    },
    [onOpenChange],
  )

  const backToPalette = React.useCallback(() => {
    void chat.stop()
    void search.stop()
    chat.setMessages([])
    search.setMessages([])
    setMode('palette')
    setInput('')
    lastNotified.current = null
  }, [chat, search])

  const reset = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen)
      if (!nextOpen) {
        void chat.stop()
        void search.stop()
        chat.setMessages([])
        search.setMessages([])
        setMode('palette')
        setInput('')
        lastNotified.current = null
      }
    },
    [onOpenChange, chat, search],
  )

  const inChat = mode !== 'palette'

  /**
   * The date the user typed, if the input IS a date. Same instant the app
   * navigates to: parse-date-query returns a local midnight, and the row only
   * appears when it parsed, so "next time I see Alex" stays a search.
   */
  const typedDate = React.useMemo(
    () => (input.trim() ? parseDateQuery(input) : null),
    [input],
  )
  const goToDate = React.useCallback(
    (date: Date) => runAction(() => actions?.goToDate(date)),
    [runAction, actions],
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={reset}
      title={t.aiAssistant}
      description={t.aiAssistantHint}
      // top-1/3 from the ui component collides with short dynamic
      // viewports (mobile URL bar): pin to a dvh-safe band instead so the
      // dialog never extends past what is actually visible.
      className="top-[max(1rem,min(33dvh,10rem))] max-h-[calc(100dvh-2rem)] sm:max-w-xl"
    >
      {/* The new CommandDialog renders children bare (no implicit Command
          root), so cmdk's context is established here explicitly. */}
      <Command className="rounded-xl!">
        <CommandInput
          placeholder={
            mode === 'search'
              ? t.aiSemanticSearchPlaceholder
              : inChat
                ? t.aiAssistantPlaceholder
                : t.aiPalettePlaceholder
          }
          value={input}
          onValueChange={setInput}
          onKeyDown={(e) => {
            // In palette mode cmdk's own Enter selects the highlighted row
            // (including the free-text search row); only intercept once
            // inside a conversation.
            if (
              e.key === 'Enter' &&
              !e.nativeEvent.isComposing &&
              inChat &&
              input.trim().length > 0
            ) {
              e.preventDefault()
              enter(mode)
            }
            // Backspace on an empty input leaves the conversation, mirroring
            // cmdk's page convention.
            if (e.key === 'Backspace' && inChat && input === '') {
              backToPalette()
            }
          }}
        />

        {/* Say what search cannot do, once, at the moment it matters: the
            user is about to type "delete that one" at a mode that will not
            do it. */}
        {mode === 'search' && (
          <p className="border-b px-3 py-1.5 text-xs text-muted-foreground">
            {t.aiSearchReadOnly}
          </p>
        )}

        {inChat ? (
          <ChatTranscript
            t={t}
            messages={active.messages}
            busy={busy}
            error={active.error ?? null}
            onApproval={chat.addToolApprovalResponse}
          />
        ) : (
          /* ScrollArea owns overflow so long command lists scroll inside
             the dvh-capped dialog instead of pushing past it. */
          <ScrollArea className="max-h-[min(18rem,calc(100dvh-12rem))]">
            <CommandList className="max-h-none">
              <CommandEmpty>{t.noMatchingEvents}</CommandEmpty>
              {/* Above the AI rows on purpose: for an input like "10/5" both
                  this and the search row match, and cmdk keeps DOM order for
                  equal scores — so the more specific reading of the same
                  keystrokes is the one Enter takes. */}
              {typedDate && (
                <CommandGroup heading={t.aiGoToDate}>
                  <CommandItem
                    value={`go-to:${input}`}
                    onSelect={() => goToDate(typedDate)}
                  >
                    <LocateFixed />
                    <span className="truncate">
                      {t.aiGoToDate}: {typedDate.toLocaleDateString(language)}
                    </span>
                    <CommandShortcut>↵</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              )}
              {AI_ENABLED && (
                <CommandGroup heading={t.aiSearch}>
                  {/* Free-text row: Enter on anything that is not a command
                      and not a date runs a semantic search over the user's
                      history. Its value tracks the raw input so it matches
                      whatever was typed. */}
                  <CommandItem
                    value={input.length > 0 ? input : t.aiSemanticSearch}
                    onSelect={() => enter('search')}
                    disabled={busy || input.trim().length === 0}
                  >
                    <CalendarSearch />
                    <span className="truncate">
                      {input.trim().length > 0
                        ? `${t.aiSemanticSearch}: ${input}`
                        : t.aiSemanticSearchHint}
                    </span>
                    <CommandShortcut>↵</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              )}
              {AI_ENABLED && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={t.aiAssistant}>
                    {/* The full assistant, with its write tools. Picked
                        explicitly — Enter on free text searches instead, so
                        "delete that" can never be a stray keystroke here. */}
                    <CommandItem
                      onSelect={() => enter('chat')}
                      disabled={busy || input.trim().length === 0}
                    >
                      <Sparkles />
                      <span className="truncate">
                        {input.trim().length > 0
                          ? `${t.aiAssistantAsk}: ${input}`
                          : t.aiAssistantEnterToAsk}
                      </span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
              {actions && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={t.calendar}>
                    <CommandItem
                      onSelect={() => runAction(actions.createEvent)}
                    >
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
                      onSelect={() => runAction(actions.previousPeriod)}
                    >
                      <ArrowLeft />
                      {t.previousPeriod}
                      <CommandShortcut>←</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runAction(actions.nextPeriod)}>
                      <ArrowRight />
                      {t.nextPeriod}
                      <CommandShortcut>→</CommandShortcut>
                    </CommandItem>
                    <CommandItem
                      onSelect={() => runAction(actions.focusSearch)}
                    >
                      <Search />
                      {t.searchEvents}
                      <CommandShortcut>/</CommandShortcut>
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup heading={t.aiView}>
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
                    <CommandItem
                      onSelect={() => runAction(actions.openSettings)}
                    >
                      <Settings />
                      {t.settings}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </ScrollArea>
        )}

        {/* Footer: a conversation gets a way back plus what it is; the
            command list gets the two conventions it offers. */}
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
              {AI_ENABLED && (
                <>
                  <Kbd>↵</Kbd>
                  {t.aiSemanticSearch}
                </>
              )}
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
