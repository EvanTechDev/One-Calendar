'use client'

/**
 * The command palette (Cmd/Ctrl+K).
 *
 * Four explicit modes share a draft: app commands, local keyword search,
 * semantic search and the write-capable AI assistant. Selecting a mode never
 * submits the draft. Search results open on Enter; semantic refinements use
 * the submit button or Cmd/Ctrl+Enter. Chat only sends in its own mode.
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
import { ScrollArea } from '@zntr/ui/scroll-area'
import { Skeleton } from '@zntr/ui/skeleton'
import { Kbd } from '@zntr/ui/kbd'
import { Button } from '@zntr/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@zntr/ui/tabs'
import type { CalendarEvent } from '@/lib/calendar-types'
import { getEventAccentColor } from '@/lib/event-colors'
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
  LoaderCircle,
  LocateFixed,
  RotateCcw,
  Rows3,
  Search,
  Settings,
  Sparkles,
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

type Mode = 'palette' | 'search' | 'chat' | 'results'

/** The resolved instants the endpoint actually searched, for the scope line. */
interface SearchScope {
  start?: string
  end?: string
}

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
      /** The question that produced this, kept for the retry row. */
      text: string
      /**
       * What was actually searched, shown above the rows. A search that cannot
       * say what it looked for cannot be told apart from one that ignored the
       * question, and every wrong answer reads as the AI making things up.
       */
      scope: SearchScope
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
  range?: SearchScope
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
}

/**
 * A colour swatch for a result row. Only a real hex is honoured; anything else
 * falls back to the muted border colour rather than being dropped into a class
 * name, because a class built at runtime is not in the stylesheet.
 */
function swatch(color: string | null): string {
  return color && /^#[0-9a-f]{3,8}$/i.test(color)
    ? 'border-transparent'
    : 'border-muted-foreground/40'
}

function swatchStyle(color: string | null): React.CSSProperties {
  return color && /^#[0-9a-f]{3,8}$/i.test(color)
    ? { backgroundColor: color }
    : {}
}

export function AiCommandPalette({
  open,
  onOpenChange,
  onEventsMutated,
  actions,
  events = [],
}: AiCommandPaletteProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const [input, setInput] = React.useState('')
  const [mode, setMode] = React.useState<Mode>('palette')
  const [search, setSearch] = React.useState<SearchState>({ status: 'idle' })
  // The next page's fetch, as distinct from a new search: the rows already on
  // screen must stay on screen while page 2 loads.
  const [loadingMore, setLoadingMore] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const panelId = React.useId()
  React.useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])
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

  const chat = useChat({
    transport: new DefaultChatTransport({ api: '/api/agent/chat' }),
    // Resume the turn automatically once every pending approval has an
    // answer — the user clicks approve/deny, the model carries on.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  })
  const chatBusy = chat.status === 'submitted' || chat.status === 'streaming'

  // Refresh the calendar after a completed turn that wrote something.
  const lastNotified = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (chat.status !== 'ready') return
    const last = chat.messages[chat.messages.length - 1]
    if (!last || last.role !== 'assistant' || last.id === lastNotified.current)
      return
    const wrote = last.parts?.some((part) => WRITE_TOOLS.has(part.type))
    if (wrote) {
      lastNotified.current = last.id
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
  }, [cancelSearch])
  const stopChat = chat.stop
  const setMessages = chat.setMessages
  React.useEffect(() => {
    if (!open) {
      resetSearch()
      void stopChat()
      setMessages([])
      setMode('palette')
      setInput('')
      lastNotified.current = null
    }
  }, [open, resetSearch, stopChat, setMessages])

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
      setMode('results')
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
                text: prev.text,
                // Paging replays the same query, so the scope cannot change;
                // keeping the first page's values avoids a flash of blanks.
                scope: body.range ?? prev.scope,
              }
            : {
                status: 'ready',
                query: body.query,
                searchToken: body.searchToken,
                results: body.results,
                page: body.page,
                total: body.total,
                hasMore: body.hasMore,
                text,
                scope: body.range ?? {},
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

  const backToCommands = React.useCallback(() => {
    void chat.stop()
    chat.setMessages([])
    resetSearch()
    setMode('palette')
    setInput('')
    lastNotified.current = null
  }, [chat, resetSearch])

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

  const placeholder =
    mode === 'chat'
      ? t.aiAssistantPlaceholder
      : mode === 'results' && search.status === 'ready'
        ? t.aiSearchRefinePlaceholder
        : t.aiSearchPlaceholder

  /**
   * What the endpoint actually searched, as chips. This is not decoration: the
   * endpoint has to guess "去年" and "和 Alex" into a date range and a name
   * filter, and without the resolved answer on screen a wrong guess is
   * indistinguishable from the AI ignoring the question. The keyword and names
   * come from the query that RAN — which, after a relaxation, is not the one the
   * model first wrote.
   */
  const scopeChips = React.useMemo(() => {
    if (search.status !== 'ready') return []
    const day = (iso: string) =>
      new Date(iso).toLocaleDateString(language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    const chips: string[] = []
    const { start, end } = search.scope
    if (start && end) chips.push(`${day(start)} – ${day(end)}`)
    else if (start) chips.push(`${t.aiSearchFrom} ${day(start)}`)
    else if (end) chips.push(`${t.aiSearchUntil} ${day(end)}`)
    if (search.query.concepts.length) {
      chips.push(
        `${t.aiSearchWords}: ${search.query.concepts.map((group) => `(${group.join(' / ')})`).join(' + ')}`,
      )
    }
    if (search.query.names?.length) {
      chips.push(`${t.aiSearchWith} ${search.query.names.join(', ')}`)
    }
    return chips
  }, [search, language, t])

  const searching = search.status === 'loading' || loadingMore
  const switchMode = (next: Mode) => {
    if (next === mode) return
    if (searching) resetSearch()
    setMode(next)
  }
  const modes = [
    { value: 'palette', label: t.commandPaletteCommands, icon: Terminal },
    { value: 'search', label: t.commandPaletteSearch, icon: Search },
    ...(AI_ENABLED
      ? [
          { value: 'results', label: t.aiSemanticSearch, icon: CalendarSearch },
          { value: 'chat', label: t.aiAssistantAsk, icon: Sparkles },
        ]
      : []),
  ] as const

  return (
    <CommandDialog
      open={open}
      onOpenChange={reset}
      title={t.commandPaletteTitle}
      description={t.commandPaletteDescription}
      // top-1/3 from the ui component collides with short dynamic
      // viewports (mobile URL bar): pin to a dvh-safe band instead so the
      // dialog never extends past what is actually visible.
      className="top-[max(1rem,min(20dvh,8rem))] max-h-[calc(100dvh-2rem)] sm:max-w-2xl"
    >
      {/* The new CommandDialog renders children bare (no implicit Command
          root), so cmdk's context is established here explicitly.
          `shouldFilter` is off in the result view: the input holds the question
          and the follow-up, not a filter, and cmdk's own matching would hide
          every row the moment the question text stopped matching a title. */}
      <Command
        label={t.commandPaletteTitle}
        className="rounded-xl! p-2"
        shouldFilter={mode === 'palette'}
        filter={filterCommand}
        onKeyDownCapture={(e) => {
          if ((e.ctrlKey || e.metaKey) && /^[1-4]$/.test(e.key)) {
            const target = modes[Number(e.key) - 1]
            if (target) {
              e.preventDefault()
              e.stopPropagation()
              switchMode(target.value as Mode)
              inputRef.current?.focus()
            }
          }
        }}
      >
        <div
          className="flex items-center gap-2 px-1 pb-2"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Tabs
            value={mode}
            onValueChange={(value) => switchMode(value as Mode)}
            className="min-w-0 flex-1"
          >
            <TabsList aria-label={t.commandPaletteTitle} className="w-full">
              {modes.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  onClick={() => inputRef.current?.focus()}
                  id={`${panelId}-${value}`}
                  aria-controls={`${panelId}-panel`}
                  className="gap-1.5 px-2 text-xs sm:text-sm"
                >
                  <Icon className="hidden size-3.5 sm:block" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
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
          role="tabpanel"
          id={`${panelId}-panel`}
          aria-labelledby={`${panelId}-${mode}`}
        >
          <div className="relative">
            <CommandInput
              ref={inputRef}
              aria-label={modes.find((item) => item.value === mode)?.label}
              placeholder={
                mode === 'palette'
                  ? t.commandPalettePlaceholder
                  : mode === 'search'
                    ? t.commandPaletteSearchPlaceholder
                    : placeholder
              }
              value={input}
              onValueChange={(value) => {
                setInput(value)
                setLocalLimit(30)
              }}
              className="pr-20"
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                const modifier = e.metaKey || e.ctrlKey
                if (e.key === 'Enter') {
                  // ⌘/Ctrl+Enter re-searches from anywhere, and in the result
                  // view it is the ONLY way to narrow: plain Enter belongs to
                  // cmdk there, which opens the highlighted event.
                  if (modifier && mode === 'results' && AI_ENABLED) {
                    e.preventDefault()
                    e.stopPropagation()
                    void runSearch(1)
                    return
                  }
                  if (mode === 'results' && search.status !== 'ready') {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!searching) void runSearch(1)
                    return
                  }
                  // Palette mode also belongs to cmdk — its Enter is what picks
                  // the highlighted command, including the search row.
                  if (mode === 'chat' && input.trim()) {
                    e.preventDefault()
                    e.stopPropagation()
                    sendToChat()
                  }
                  return
                }
              }}
            />
            {(mode === 'chat' || mode === 'results') && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                aria-label={
                  mode === 'chat'
                    ? chatBusy
                      ? t.commandPaletteStop
                      : t.send
                    : t.aiSemanticSearch
                }
                disabled={
                  mode === 'results'
                    ? searching || !input.trim()
                    : !chatBusy && !input.trim()
                }
                onClick={() =>
                  mode === 'chat'
                    ? chatBusy
                      ? void chat.stop()
                      : sendToChat()
                    : void runSearch(1)
                }
              >
                {mode === 'chat' && chatBusy ? <Square /> : <ArrowRight />}
              </Button>
            )}
            {/* The one piece of feedback search gets: it is working. */}
            {searching && (
              <LoaderCircle
                className="pointer-events-none absolute right-12 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                aria-hidden
              />
            )}
          </div>

          {mode === 'results' && scopeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 border-b px-3 py-1.5 text-xs text-muted-foreground">
              <span>{t.aiSearchScope}</span>
              {scopeChips.map((chip) => (
                <span key={chip} className="rounded bg-muted px-1.5 py-0.5">
                  {chip}
                </span>
              ))}
            </div>
          )}

          {mode === 'search' ? (
            <CommandList className="min-h-48 max-h-[min(24rem,calc(100dvh-15rem))]">
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {t.commandPaletteSearchHint}
              </div>
              {!input.trim() ? (
                <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                  {t.commandPaletteSearchPlaceholder}
                </p>
              ) : localResults.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                  {t.noMatchingEvents}
                </p>
              ) : (
                <CommandGroup heading={`${localResults.length} ${t.events}`}>
                  {localResults.slice(0, localLimit).map((event) => (
                    <CommandItem
                      key={event.id}
                      value={`local:${event.id}`}
                      className="gap-3 py-2.5"
                      onSelect={() =>
                        goToEvent({
                          ...event,
                          startDate: new Date(event.startDate).toISOString(),
                          endDate: new Date(event.endDate).toISOString(),
                          location: event.location ?? null,
                          color: event.color ?? null,
                        })
                      }
                    >
                      <span
                        className="h-7 w-1 shrink-0 rounded-full"
                        style={{
                          backgroundColor: getEventAccentColor(event.color),
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {event.title || t.unnamedEvent}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatWhen({
                            ...event,
                            startDate: new Date(event.startDate).toISOString(),
                            endDate: new Date(event.endDate).toISOString(),
                            location: event.location ?? null,
                            color: event.color ?? null,
                          })}
                          {event.location ? ` · ${event.location}` : ''}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                  {localResults.length > localLimit && (
                    <CommandItem
                      value="local:more"
                      onSelect={() => setLocalLimit((value) => value + 30)}
                    >
                      {t.aiSearchMore}
                    </CommandItem>
                  )}
                </CommandGroup>
              )}
            </CommandList>
          ) : mode === 'results' ? (
            <ScrollArea className="max-h-[min(20rem,calc(100dvh-12rem))]">
              <CommandList className="max-h-none">
                {search.status === 'idle' && (
                  <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                    {t.aiSemanticSearchHint}
                  </p>
                )}
                {search.status === 'loading' && (
                  <div className="space-y-2 px-2 py-1" aria-live="polite">
                    <span className="text-xs text-muted-foreground">
                      {t.aiSearchLoading}
                    </span>
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="flex items-center gap-3">
                        <Skeleton className="size-2.5 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-3.5 w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {search.status === 'ready' &&
                  search.results.map((hit) => (
                    <CommandItem
                      key={hit.id}
                      value={`hit:${hit.id}`}
                      onSelect={() => goToEvent(hit)}
                    >
                      <span
                        className={`size-2.5 shrink-0 rounded-full border-2 ${swatch(hit.color)}`}
                        style={swatchStyle(hit.color)}
                        aria-hidden
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-xs text-muted-foreground">
                          {formatWhen(hit)}
                        </span>
                        <span className="truncate font-medium">
                          {hit.title}
                        </span>
                        {hit.location && (
                          <span className="truncate text-xs text-muted-foreground">
                            {hit.location}
                          </span>
                        )}
                      </span>
                    </CommandItem>
                  ))}
                {search.status === 'ready' && search.results.length === 0 && (
                  <>
                    <CommandItem value="empty" disabled>
                      {t.noMatchingEvents}
                    </CommandItem>
                    <CommandItem
                      value="empty-hint"
                      disabled
                      className="text-xs text-muted-foreground"
                    >
                      {t.aiSearchNoResultsHint}
                    </CommandItem>
                  </>
                )}
                {search.status === 'ready' && search.hasMore && (
                  <CommandItem
                    value="load-more"
                    onSelect={() => void runSearch(search.page + 1)}
                    disabled={loadingMore}
                  >
                    <LoaderCircle
                      className={loadingMore ? 'animate-spin' : undefined}
                    />
                    {t.aiSearchMore}
                  </CommandItem>
                )}
                {search.status === 'error' && (
                  <>
                    <CommandItem
                      value="search-error"
                      disabled
                      className="text-destructive"
                    >
                      {search.kind === 'rate'
                        ? t.aiSearchRateLimited
                        : search.kind === 'timeout'
                          ? t.aiSearchTimedOut
                          : search.kind === 'unavailable'
                            ? t.aiSearchUnavailable
                            : t.aiSearchFailed}
                    </CommandItem>
                    {/* A missing key is not something a retry can fix, so that
                      one state gets no retry row. */}
                    {search.kind !== 'unavailable' && (
                      <CommandItem
                        value="search-retry"
                        onSelect={() => void runSearch(1)}
                      >
                        <RotateCcw />
                        {t.aiSearchRetry}
                      </CommandItem>
                    )}
                  </>
                )}
              </CommandList>
            </ScrollArea>
          ) : mode === 'chat' ? (
            <ChatTranscript
              t={t}
              messages={chat.messages}
              busy={chatBusy}
              error={chat.error ?? null}
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
                      <CommandItem
                        onSelect={() => runAction(actions.goToToday)}
                      >
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
                      <CommandItem
                        onSelect={() => runAction(actions.nextPeriod)}
                      >
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
                        onSelect={() =>
                          runAction(() => actions.setView('week'))
                        }
                      >
                        <Rows3 />
                        {t.week}
                        <CommandShortcut>2</CommandShortcut>
                      </CommandItem>
                      <CommandItem
                        onSelect={() =>
                          runAction(() => actions.setView('month'))
                        }
                      >
                        <Grid3x3 />
                        {t.month}
                        <CommandShortcut>3</CommandShortcut>
                      </CommandItem>
                      <CommandItem
                        onSelect={() =>
                          runAction(() => actions.setView('year'))
                        }
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
        </div>
        {/* Footer: each mode states what its keys do, because they differ —
            results open on Enter and search on ⌘↵, chat sends on Enter. */}
        <div className="flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
          {mode === 'chat' ? (
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1 hover:text-foreground"
              onClick={backToCommands}
            >
              <ArrowLeft className="size-3" />
              {t.aiAssistantBack}
            </button>
          ) : mode === 'results' ? (
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd>
                {t.aiSearchOpen}
              </span>
              <span className="flex items-center gap-1">
                <Kbd>⌘↵</Kbd>
                {t.aiSearchAgain}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Kbd>↑ ↓</Kbd>
              <Kbd>↵</Kbd>
              {mode === 'search' ? t.aiSearchOpen : t.commandPaletteRun}
            </span>
          )}
          <span className="hidden sm:inline">Ctrl / ⌘ 1–{modes.length}</span>
          <span className="flex items-center gap-1">
            <Kbd>esc</Kbd>
            {t.close}
          </span>
        </div>
      </Command>
    </CommandDialog>
  )
}
