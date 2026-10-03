'use client'

/**
 * The command palette (Cmd/Ctrl+K).
 *
 * Three modes, one input:
 *  - Palette: cmdk filters a list of app commands. Typing a date offers a
 *    "go to date" row; typing anything else offers the semantic-search row.
 *    Enter on free text runs the search.
 *  - Results: the search's answer, as a LIST of events — not a conversation.
 *    The model never writes here; it only turns the question into a query
 *    (`POST /api/agent/search`) and the rows are the database's own. Nothing
 *    about how the answer was found is shown, because there is nothing to
 *    show: there is no tool loop and no prose. Plain Enter opens the
 *    highlighted event, so a follow-up question has to be ⌘/Ctrl+Enter.
 *  - Chat: the full assistant, entered by picking "Ask AI" explicitly. It can
 *    create, change and delete, and destructive tools pause for confirmation.
 *
 * Why search is not reachable from the chat's Enter: the chat is an agent with
 * write tools. "delete that one" typed at a search box must never be a write,
 * so the write-capable surface is one deliberate click away instead.
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
} from 'lucide-react'
import { translations, useLanguage } from '@zntr/i18n/calendar'
// Type-only, so the client bundle never pulls in the agent's tool schemas.
import type { Relaxation, SearchQuery } from '@zntr/agent'
import { parseDateQuery } from '@/lib/parse-date-query'

/**
 * Build-time presence flag from next.config.ts — never the key itself. It
 * gates the AI rows only: the palette itself is a keyboard surface for the
 * calendar and must work on a deployment with no model configured.
 */
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === '1'

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

/** Exactly the keys this file reads, so a rename cannot slip through. */
type TranslationKey = keyof (typeof translations)['en']

/**
 * Which filter the endpoint gave up to find rows, in the user's words rather
 * than the plan's. See buildSearchPlan for why this is ordered the way it is;
 * this is only the sentence that says so.
 */
const RELAXED: Record<Relaxation, TranslationKey> = {
  names: 'aiSearchDropNames',
  categories: 'aiSearchDropCategories',
  range: 'aiSearchDropRange',
  keyword: 'aiSearchDropKeyword',
}

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

type Mode = 'palette' | 'chat' | 'results'

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
      /** The user's question named no date, so a window was assumed. */
      defaultedRange: boolean
      /** A filter was dropped to find these rows — see buildSearchPlan. */
      relaxed: Relaxation | null
    }
  | { status: 'error'; kind: 'rate' | 'unavailable' | 'failed' }

interface SearchResponseBody {
  query: SearchQuery
  results: PaletteSearchHit[]
  page: number
  total: number
  totalPages: number
  hasMore: boolean
  range?: SearchScope
  defaultedRange?: boolean
  relaxed?: Relaxation | null
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
}: AiCommandPaletteProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const [input, setInput] = React.useState('')
  const [mode, setMode] = React.useState<Mode>('palette')
  const [search, setSearch] = React.useState<SearchState>({ status: 'idle' })
  // The next page's fetch, as distinct from a new search: the rows already on
  // screen must stay on screen while page 2 loads.
  const [loadingMore, setLoadingMore] = React.useState(false)

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

  // A search in flight belongs to the dialog that started it: closing must not
  // leave a response to arrive into a palette the user has moved on from.
  const inFlight = React.useRef<AbortController | null>(null)
  const cancelSearch = React.useCallback(() => {
    inFlight.current?.abort()
    inFlight.current = null
  }, [])

  const resetSearch = React.useCallback(() => {
    cancelSearch()
    setSearch({ status: 'idle' })
    setLoadingMore(false)
  }, [cancelSearch])

  /**
   * Page 1 asks the model for a query; later pages replay the query the client
   * already has, so paging costs nothing and cannot drift. A follow-up (page 1
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

      try {
        const response = await fetch('/api/agent/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(
            page > 1
              ? { page, resolved: ready?.query }
              : { text, previousQuery: ready?.query },
          ),
        })
        if (!response.ok) {
          setSearch({
            status: 'error',
            kind:
              response.status === 429
                ? 'rate'
                : response.status === 503
                  ? 'unavailable'
                  : 'failed',
          })
          return
        }
        const body = (await response.json()) as SearchResponseBody
        setSearch((prev) =>
          page > 1 && prev.status === 'ready'
            ? {
                status: 'ready',
                query: prev.query,
                results: [...prev.results, ...body.results],
                page: body.page,
                total: body.total,
                hasMore: body.hasMore,
                text: prev.text,
                // Paging replays the same query, so the scope cannot change;
                // keeping the first page's values avoids a flash of blanks.
                scope: body.range ?? prev.scope,
                defaultedRange: body.defaultedRange ?? prev.defaultedRange,
                relaxed: body.relaxed ?? prev.relaxed,
              }
            : {
                status: 'ready',
                query: body.query,
                results: body.results,
                page: body.page,
                total: body.total,
                hasMore: body.hasMore,
                text,
                scope: body.range ?? {},
                defaultedRange: body.defaultedRange ?? false,
                relaxed: body.relaxed ?? null,
              },
        )
      } catch {
        // An abort is the user closing the dialog, not a failure.
        if (controller.signal.aborted) return
        setSearch({ status: 'error', kind: 'failed' })
      } finally {
        if (inFlight.current === controller) inFlight.current = null
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
      if (!nextOpen) {
        void chat.stop()
        chat.setMessages([])
        resetSearch()
        setMode('palette')
        setInput('')
        lastNotified.current = null
      }
    },
    [chat, onOpenChange, resetSearch],
  )

  const inConversation = mode !== 'palette'

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
    if (search.query.query) {
      chips.push(`${t.aiSearchWords}: ${search.query.query}`)
    }
    if (search.query.names?.length) {
      chips.push(`${t.aiSearchWith} ${search.query.names.join(', ')}`)
    }
    if (search.defaultedRange) chips.push(t.aiSearchDefaultRange)
    if (search.relaxed)
      chips.push(`${t.aiSearchRelaxed}: ${RELAXED[search.relaxed]}`)
    return chips
  }, [search, language, t])

  const searching = search.status === 'loading' || loadingMore

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
          root), so cmdk's context is established here explicitly.
          `shouldFilter` is off in the result view: the input holds the question
          and the follow-up, not a filter, and cmdk's own matching would hide
          every row the moment the question text stopped matching a title. */}
      <Command className="rounded-xl!" shouldFilter={mode !== 'results'}>
        <div className="relative">
          <CommandInput
            placeholder={placeholder}
            value={input}
            onValueChange={setInput}
            className="pr-8"
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              const modifier = e.metaKey || e.ctrlKey
              if (e.key === 'Enter') {
                // ⌘/Ctrl+Enter re-searches from anywhere, and in the result
                // view it is the ONLY way to narrow: plain Enter belongs to
                // cmdk there, which opens the highlighted event.
                if (modifier) {
                  e.preventDefault()
                  void runSearch(1)
                  return
                }
                // Palette mode also belongs to cmdk — its Enter is what picks
                // the highlighted command, including the search row.
                if (mode === 'chat' && input.trim()) {
                  e.preventDefault()
                  sendToChat()
                }
                return
              }
              // Backspace on an empty input leaves the conversation, mirroring
              // cmdk's page convention.
              if (e.key === 'Backspace' && input === '' && inConversation) {
                backToCommands()
              }
            }}
          />
          {/* The one piece of feedback search gets: it is working. */}
          {searching && (
            <LoaderCircle
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
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

        {mode === 'results' ? (
          <ScrollArea className="max-h-[min(20rem,calc(100dvh-12rem))]">
            <CommandList className="max-h-none">
              {/* First row, so one keystroke is always the way back out. */}
              <CommandItem value="back-to-commands" onSelect={backToCommands}>
                <ArrowLeft />
                {t.aiSearchBack}
              </CommandItem>
              {search.status === 'loading' && (
                <div className="space-y-2 px-2 py-1" aria-live="polite">
                  <span className="sr-only">{t.aiSearchLoading}</span>
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
                      <span className="truncate font-medium">{hit.title}</span>
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
                    onSelect={() => void runSearch(1)}
                    disabled={searching || input.trim().length === 0}
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
                      onSelect={sendToChat}
                      disabled={chatBusy || input.trim().length === 0}
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
