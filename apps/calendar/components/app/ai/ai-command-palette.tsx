'use client'

/**
 * The command palette (Cmd/Ctrl+K).
 *
 * Commands, search and the AI assistant share a draft. Search matches locally
 * while typing; Enter submits to semantic search. Arrow keys select a result
 * to open with Enter. Selecting a mode never submits the draft.
 *
 * Heights are dvh-based: on mobile the browser's URL bar eats real viewport,
 * and a vh-sized dialog put its bottom out of reach.
 */
import * as React from 'react'
import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai'
import { ChatTranscript } from './chat-transcript'
import { AssistantIcon } from './assistant-icon'
import {
  PaletteWorkspaceCommands,
  type CommandPage,
  type WorkspaceCommands,
} from './palette-workspace-commands'
import { PaletteSearchResults } from './palette-search-results'
import {
  commandFilter,
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
import { Button } from '@zntr/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@zntr/ui/dropdown-menu'
import { Textarea } from '@zntr/ui/textarea'
import type { CalendarEvent } from '@/lib/calendar-types'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChartNoAxesColumn,
  ChevronDown,
  Columns4,
  Grid3x3,
  LoaderCircle,
  LocateFixed,
  RotateCcw,
  Rows3,
  Search,
  Settings,
  Sun,
  Terminal,
  X,
  Square,
} from 'lucide-react'
import { translations, useLanguage } from '@zntr/i18n/calendar'
// Type-only, so the client bundle never pulls in the agent's tool schemas.
import type { SearchQuery } from '@zntr/agent/search'
import { parseDateQuery } from '@/lib/parse-date-query'

/**
 * Build-time presence flag from next.config.ts — never the key itself. It
 * gates the AI rows only: the palette itself is a keyboard surface for the
 * calendar and must work on a deployment with no model configured.
 */
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === '1'

// These are actions, not text matches. Stable identities keep cmdk's selection
// attached while typing; its normal item trimming otherwise hides a search
// action as soon as the question ends with whitespace.
const DATE_ACTION = 'action:go-to-date'
// Allow the server's 270s deadline to report first, but do not leave a stalled
// network request spinning forever if that response never reaches the browser.
const SEARCH_TIMEOUT_MS = 285_000
function filterCommand(value: string, search: string, keywords?: string[]) {
  if (value === DATE_ACTION) return 1
  return commandFilter(value, search.trim(), keywords)
}

/** One row of a search result, as the endpoint returns it. */
export interface PaletteSearchHit {
  id: string
  title: string
  startDate: string
  endDate: string
  isAllDay: boolean
  location: string | null
  color: string | null
}

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
  /**
   * Open a search result. It carries no more than the list showed plus the
   * fields the preview reads, so the calendar owns the lookup against its own
   * loaded events and this stays a plain row.
   */
  goToEvent: (hit: PaletteSearchHit) => void
}

type Mode = 'palette' | 'search' | 'chat'

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'ready'
      query: SearchQuery
      searchToken: string
      results: PaletteSearchHit[]
      page: number
      total: number
      hasMore: boolean
    }
  | { status: 'error'; kind: 'rate' | 'unavailable' | 'failed' | 'timeout' }

interface SearchResponseBody {
  searchToken: string
  query: SearchQuery
  results: PaletteSearchHit[]
  page: number
  total: number
  totalPages: number
  hasMore: boolean
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
  events?: CalendarEvent[]
  workspace?: WorkspaceCommands
}

export function AiCommandPalette({
  open,
  onOpenChange,
  onEventsMutated,
  actions,
  events = [],
  workspace,
}: AiCommandPaletteProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const [input, setInput] = React.useState('')
  const [mode, setMode] = React.useState<Mode>('palette')
  const [commandTrail, setCommandTrail] = React.useState<CommandPage[]>([])
  const commandPage = commandTrail.at(-1) ?? null
  const navigateCommand = (page: CommandPage | null) => {
    setCommandTrail((trail) => (page ? [...trail, page] : trail.slice(0, -1)))
    setInput('')
    inputRef.current?.focus()
  }
  const [search, setSearch] = React.useState<SearchState>({ status: 'idle' })
  // The next page's fetch, as distinct from a new search: the rows already on
  // screen must stay on screen while page 2 loads.
  const [loadingMore, setLoadingMore] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const composerRef = React.useRef<HTMLTextAreaElement>(null)
  const focusInput = React.useCallback(() => {
    if (mode === 'chat') composerRef.current?.focus()
    else inputRef.current?.focus()
  }, [mode])
  React.useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(focusInput)
    return () => cancelAnimationFrame(frame)
  }, [open, focusInput])
  const localResults = React.useMemo(() => {
    const keyword = input.trim().toLowerCase()
    if (mode !== 'search' || !keyword) return []
    return events
      .filter((event) =>
        [event.title, event.description, event.location].some((value) =>
          value?.toLowerCase().includes(keyword),
        ),
      )
      .sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      )
  }, [events, input, mode])
  const [localLimit, setLocalLimit] = React.useState(30)
  const [navigatingResults, setNavigatingResults] = React.useState(false)

  const chat = useChat({
    transport: new DefaultChatTransport({ api: '/api/agent/chat' }),
    // Resume the turn automatically once every pending approval has an
    // answer — the user clicks approve/deny, the model carries on.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  })
  const chatBusy = chat.status === 'submitted' || chat.status === 'streaming'
  const [chatTimedOut, setChatTimedOut] = React.useState(false)
  // A broken connection must not leave the composer disabled forever.
  React.useEffect(() => {
    if (!chatBusy) return
    const timer = setTimeout(() => {
      setChatTimedOut(true)
      void chat.stop()
    }, 285_000)
    return () => clearTimeout(timer)
  }, [chatBusy, chat.stop])

  // Show confirmed writes even if a later step fails or the user stops.
  const lastNotified = React.useRef<string | null>(null)
  React.useEffect(() => {
    const last = chat.messages[chat.messages.length - 1]
    if (!last || last.role !== 'assistant') return
    const writes = last.parts?.filter(
      (part) =>
        WRITE_TOOLS.has(part.type) &&
        'state' in part &&
        part.state === 'output-available',
    )
    const signature = `${last.id}:${writes.length}`
    if (writes.length && signature !== lastNotified.current) {
      lastNotified.current = signature
      onEventsMutated?.()
    }
  }, [chat.status, chat.messages, onEventsMutated])

  // A search in flight belongs to the dialog that started it: closing must not
  // leave a response to arrive into a palette the user has moved on from.
  const inFlight = React.useRef<AbortController | null>(null)
  const cancelSearch = React.useCallback(() => {
    inFlight.current?.abort()
    inFlight.current = null
  }, [])
  React.useEffect(() => cancelSearch, [cancelSearch])

  const resetSearch = React.useCallback(() => {
    cancelSearch()
    setSearch({ status: 'idle' })
    setLoadingMore(false)
    setNavigatingResults(false)
  }, [cancelSearch])
  const stopChat = chat.stop
  React.useEffect(() => {
    if (!open) {
      resetSearch()
      void stopChat()
      setMode('palette')
      setCommandTrail([])
      setInput('')
      lastNotified.current = null
    }
  }, [open, resetSearch, stopChat])

  /**
   * Page 1 asks the model to judge candidates; later pages replay sealed
   * decisions, so paging uses no model and cannot drift. A follow-up (page 1
   * with results on screen) sends the previous query too, and the model
   * returns a complete new one rather than a patch.
   */
  const runSearch = React.useCallback(
    async (page: number) => {
      const ready = search.status === 'ready' ? search : null
      const text = input.trim()
      if (page > 1 && !ready) return
      if (page === 1 && !text) return

      cancelSearch()
      const controller = new AbortController()
      inFlight.current = controller
      setMode('search')
      setNavigatingResults(false)
      if (page > 1) setLoadingMore(true)
      else setSearch({ status: 'loading' })

      const timeout = setTimeout(() => {
        if (inFlight.current !== controller) return
        controller.abort()
        inFlight.current = null
        setLoadingMore(false)
        setSearch({ status: 'error', kind: 'timeout' })
      }, SEARCH_TIMEOUT_MS)
      controller.signal.addEventListener('abort', () => clearTimeout(timeout), {
        once: true,
      })

      try {
        const response = await fetch('/api/agent/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(
            page > 1
              ? { page, searchToken: ready?.searchToken }
              : {
                  text,
                  previousQuery: ready?.query,
                  previousToken: ready?.searchToken,
                },
          ),
        })
        if (controller.signal.aborted) return
        if (!response.ok) {
          setSearch({
            status: 'error',
            kind:
              response.status === 504
                ? 'timeout'
                : response.status === 429
                  ? 'rate'
                  : response.status === 503
                    ? 'unavailable'
                    : 'failed',
          })
          return
        }
        const body = (await response.json()) as SearchResponseBody
        if (controller.signal.aborted) return
        setSearch((prev) =>
          page > 1 && prev.status === 'ready'
            ? {
                status: 'ready',
                query: prev.query,
                searchToken: body.searchToken,
                results: [...prev.results, ...body.results],
                page: body.page,
                total: body.total,
                hasMore: body.hasMore,
              }
            : {
                status: 'ready',
                query: body.query,
                searchToken: body.searchToken,
                results: body.results,
                page: body.page,
                total: body.total,
                hasMore: body.hasMore,
              },
        )
      } catch {
        // An abort is the user closing the dialog, not a failure.
        if (controller.signal.aborted) return
        setSearch({ status: 'error', kind: 'failed' })
      } finally {
        clearTimeout(timeout)
        if (inFlight.current === controller) {
          inFlight.current = null
          setLoadingMore(false)
        }
      }
    },
    [cancelSearch, input, search],
  )

  const sendToChat = React.useCallback(() => {
    const text = input.trim()
    if (!text || chatBusy) return
    setMode('chat')
    setChatTimedOut(false)
    setInput('')
    void chat.sendMessage({ text })
  }, [chat, chatBusy, input])

  const runAction = React.useCallback(
    (fn?: () => void) => {
      onOpenChange(false)
      fn?.()
    },
    [onOpenChange],
  )

  const newConversation = React.useCallback(() => {
    void chat.stop()
    chat.setMessages([])
    setChatTimedOut(false)
    setInput('')
    lastNotified.current = null
    composerRef.current?.focus()
  }, [chat])

  const reset = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen)
    },
    [onOpenChange],
  )

  /** "The date the user typed, if the input IS one. */
  const typedDate = React.useMemo(
    () => (input.trim() ? parseDateQuery(input) : null),
    [input],
  )

  const goToDate = React.useCallback(
    (date: Date) => runAction(() => actions?.goToDate(date)),
    [runAction, actions],
  )
  const goToEvent = React.useCallback(
    (hit: PaletteSearchHit) => runAction(() => actions?.goToEvent(hit)),
    [runAction, actions],
  )

  /** Date and time in the user's own language and wall clock. */
  const formatWhen = React.useCallback(
    (hit: PaletteSearchHit) => {
      const start = new Date(hit.startDate)
      const date = start.toLocaleDateString(language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        weekday: 'short',
      })
      const time = hit.isAllDay
        ? t.allDay
        : start.toLocaleTimeString(language, {
            hour: '2-digit',
            minute: '2-digit',
          })
      return `${date} · ${time}`
    },
    [language, t],
  )

  const searching = search.status === 'loading' || loadingMore
  const switchMode = (next: Mode) => {
    if (next === mode) return
    resetSearch()
    setMode(next)
  }
  const modes = [
    { value: 'palette', label: t.commandPaletteCommands, icon: Terminal },
    { value: 'search', label: t.commandPaletteSearch, icon: Search },
    ...(AI_ENABLED
      ? [{ value: 'chat', label: t.aiAssistantAsk, icon: AssistantIcon }]
      : []),
  ] as const
  const activeMode = modes.find((item) => item.value === mode) ?? modes[0]
  const ModeIcon = activeMode.icon

  return (
    <CommandDialog
      open={open}
      onOpenChange={reset}
      onEscapeKeyDown={(event) => {
        if (mode === 'palette' && commandPage) {
          event.preventDefault()
          event.stopPropagation()
          navigateCommand(null)
        }
      }}
      title={t.commandPaletteTitle}
      description={t.commandPaletteDescription}
      // top-1/3 from the ui component collides with short dynamic
      // viewports (mobile URL bar): pin to a dvh-safe band instead so the
      // dialog never extends past what is actually visible.
      className={`top-[max(1rem,min(20dvh,8rem))] flex max-h-[calc(100dvh-max(1rem,min(20dvh,8rem))-1rem)] flex-col sm:max-w-2xl ${mode === 'chat' ? 'h-[min(38rem,calc(100dvh-max(1rem,min(20dvh,8rem))-1rem))]' : ''}`}
    >
      {/* The new CommandDialog renders children bare (no implicit Command
          root), so cmdk's context is established here explicitly.
          `shouldFilter` is off in the result view: the input holds the question
          and the follow-up, not a filter, and cmdk's own matching would hide
          every row the moment the question text stopped matching a title. */}
      <Command
        label={t.commandPaletteTitle}
        className="min-h-0 flex-1 rounded-xl! p-2"
        shouldFilter={mode === 'palette'}
        filter={filterCommand}
        onKeyDownCapture={(e) => {
          if (
            mode === 'palette' &&
            commandPage &&
            e.key === 'Backspace' &&
            !input
          ) {
            e.preventDefault()
            e.stopPropagation()
            navigateCommand(null)
            return
          }
          if (
            e.altKey &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.shiftKey &&
            (e.key === 'ArrowUp' || e.key === 'ArrowDown')
          ) {
            e.preventDefault()
            e.stopPropagation()
            const index = modes.findIndex((item) => item.value === mode)
            const step = e.key === 'ArrowDown' ? 1 : -1
            switchMode(
              modes[(index + step + modes.length) % modes.length].value as Mode,
            )
          }
        }}
      >
        <div
          className="flex shrink-0 items-center gap-1 border-b pb-2"
          onKeyDown={(e) => {
            // Header buttons own Enter; it must not also run cmdk's selected row.
            if (e.target instanceof Element && e.target.closest('button'))
              e.stopPropagation()
          }}
        >
          {mode === 'palette' && commandPage && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.back}
              onClick={() => navigateCommand(null)}
            >
              <ArrowLeft />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1.5 px-2"
                aria-label={`${t.commandPaletteMode}: ${activeMode.label}`}
                title="Alt + ↑ / ↓"
                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              >
                <ModeIcon className="size-4" />
                <span className="hidden sm:inline">{activeMode.label}</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              onKeyDown={(e) => e.stopPropagation()}
              onCloseAutoFocus={(e) => {
                e.preventDefault()
                focusInput()
              }}
            >
              <DropdownMenuRadioGroup
                value={mode}
                onValueChange={(value) => switchMode(value as Mode)}
              >
                {modes.map(({ value, label, icon: Icon }) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    <Icon />
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {mode !== 'chat' ? (
            <div className="relative min-w-0 flex-1 [&_[data-slot=command-input-wrapper]]:p-0">
              <CommandInput
                ref={inputRef}
                aria-label={activeMode.label}
                placeholder={
                  mode === 'palette'
                    ? t.commandPalettePlaceholder
                    : t.commandPaletteSearchPlaceholder
                }
                value={input}
                onValueChange={(value) => {
                  setInput(value)
                  setLocalLimit(30)
                  resetSearch()
                }}
                className={mode === 'search' && AI_ENABLED ? 'pr-9' : undefined}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return
                  if (
                    mode === 'search' &&
                    (e.key === 'ArrowDown' || e.key === 'ArrowUp')
                  ) {
                    setNavigatingResults(
                      search.status === 'idle'
                        ? localResults.length > 0
                        : search.status === 'ready'
                          ? search.results.length > 0
                          : search.status === 'error' &&
                            search.kind !== 'unavailable',
                    )
                  }
                  if (e.key !== 'Enter') return
                  if (mode === 'search' && AI_ENABLED && !navigatingResults) {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!searching) void runSearch(1)
                  }
                }}
              />
              {mode === 'search' && AI_ENABLED && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-0 top-1/2 -translate-y-1/2"
                  aria-label={t.aiSemanticSearch}
                  disabled={searching || !input.trim()}
                  onClick={() => void runSearch(1)}
                >
                  {searching ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <ArrowRight />
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-1 justify-end">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.aiAssistantNewChat}
                title={t.aiAssistantNewChat}
                onClick={newConversation}
                disabled={chat.messages.length === 0 && !chatBusy}
              >
                <RotateCcw />
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.close}
            onClick={() => reset(false)}
          >
            <X />
          </Button>
        </div>
        <div
          className={
            mode === 'chat'
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
              : 'min-h-0 overflow-y-auto overscroll-contain'
          }
        >
          {mode === 'search' && search.status === 'idle' ? (
            <PaletteSearchResults
              t={t}
              status={input.trim() ? 'ready' : 'idle'}
              hits={localResults.slice(0, localLimit).map((event) => ({
                ...event,
                startDate: new Date(event.startDate).toISOString(),
                endDate: new Date(event.endDate).toISOString(),
                location: event.location ?? null,
                color: event.color ?? null,
              }))}
              total={localResults.length}
              onSelect={goToEvent}
              formatWhen={formatWhen}
              onMore={
                localResults.length > localLimit
                  ? () => setLocalLimit((value) => value + 30)
                  : undefined
              }
            />
          ) : mode === 'search' ? (
            <PaletteSearchResults
              t={t}
              status={search.status}
              hits={search.status === 'ready' ? search.results : []}
              total={search.status === 'ready' ? search.total : 0}
              onSelect={goToEvent}
              formatWhen={formatWhen}
              loadingMore={loadingMore}
              onMore={
                search.status === 'ready' && search.hasMore
                  ? () => void runSearch(search.page + 1)
                  : undefined
              }
              error={
                search.status === 'error'
                  ? search.kind === 'rate'
                    ? t.aiSearchRateLimited
                    : search.kind === 'timeout'
                      ? t.aiSearchTimedOut
                      : search.kind === 'unavailable'
                        ? t.aiSearchUnavailable
                        : t.aiSearchFailed
                  : undefined
              }
              onRetry={
                search.status === 'error' && search.kind !== 'unavailable'
                  ? () => void runSearch(1)
                  : undefined
              }
            />
          ) : mode === 'chat' ? (
            <>
              <ChatTranscript
                t={t}
                messages={chat.messages}
                busy={chatBusy}
                error={chat.error ?? null}
                timedOut={chatTimedOut}
                onContinue={() => {
                  setChatTimedOut(false)
                  void chat.sendMessage({ text: t.aiAssistantContinuePrompt })
                }}
                onApproval={chat.addToolApprovalResponse}
              />
              <div className="relative mx-1 my-2 shrink-0 rounded-lg border bg-muted/30 focus-within:ring-1 focus-within:ring-ring">
                <Textarea
                  ref={composerRef}
                  aria-label={t.aiAssistantAsk}
                  placeholder={t.aiAssistantPlaceholder}
                  value={input}
                  rows={2}
                  className="h-20 min-h-0 max-h-28 field-sizing-fixed resize-none overflow-y-auto border-0 bg-transparent! pr-12 shadow-none focus-visible:ring-0"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (
                      e.key === 'Enter' &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault()
                      sendToChat()
                    }
                  }}
                />
                <Button
                  size="icon-sm"
                  variant={chatBusy ? 'secondary' : 'default'}
                  className="absolute bottom-2 right-2"
                  aria-label={chatBusy ? t.commandPaletteStop : t.send}
                  disabled={!chatBusy && !input.trim()}
                  onClick={() => (chatBusy ? void chat.stop() : sendToChat())}
                >
                  {chatBusy ? <Square /> : <ArrowRight />}
                </Button>
              </div>
            </>
          ) : (
            <CommandList className="max-h-[min(24rem,calc(100dvh-13rem))] overscroll-contain">
              <CommandEmpty>{t.noMatchingEvents}</CommandEmpty>
              {/* Date navigation precedes general commands on equal scores. */}
              {!commandPage && typedDate && (
                <CommandGroup heading={t.aiGoToDate}>
                  <CommandItem
                    value={DATE_ACTION}
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
              {workspace && (
                <PaletteWorkspaceCommands
                  t={t}
                  events={events}
                  query={input}
                  page={commandPage}
                  navigate={navigateCommand}
                  workspace={workspace}
                  run={runAction}
                  preview={(event) =>
                    goToEvent({
                      ...event,
                      startDate: new Date(event.startDate).toISOString(),
                      endDate: new Date(event.endDate).toISOString(),
                      location: event.location ?? null,
                      color: event.color ?? null,
                    })
                  }
                />
              )}
              {!commandPage && actions && (
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
                      onSelect={() => {
                        setInput('')
                        switchMode('search')
                      }}
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
          )}
        </div>
        <div className="flex shrink-0 items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
          {mode === 'chat' ? (
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd>
              {t.send}
              <span className="ml-2 hidden sm:inline">
                Shift ↵ · {t.aiAssistantNewLine}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Kbd>↑ ↓</Kbd>
              <Kbd>↵</Kbd>
              {mode === 'search'
                ? AI_ENABLED && !navigatingResults
                  ? t.aiSemanticSearch
                  : t.aiSearchOpen
                : t.commandPaletteRun}
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
