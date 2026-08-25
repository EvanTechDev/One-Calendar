'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Clock,
  Copy,
  MessageSquare,
  Search,
  Trash2,
  User,
  Users,
  Video,
  X,
} from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { Badge } from '@zntr/ui/badge'
import { Spinner } from '@zntr/ui/spinner'
import { toast } from 'sonner'
import { cn } from '@zntr/utils'
import {
  SEARCH_DEBOUNCE_MS,
  describeMatches,
  shouldSearch,
} from '@/lib/search-matches'
import type { MatchSnippet, MeetingMatch } from '@/lib/search-matches'

export interface MeetingRow {
  id: string
  createdAt: string
  endedAt: string | null
  eventTitle: string | null
  totalMinutes: number
  attendees: number
  /**
   * Why this row matched, on a search result. Absent on the plain recent list —
   * nothing there matched anything.
   */
  matches?: MeetingMatch[]
}

/**
 * The user's own meetings, with the duration and attendance the webhooks
 * recorded.
 *
 * Search runs server-side over room codes, attendee names, and retained chat
 * (ADR 0020). Event titles are deliberately NOT searched: the calendar encrypts
 * them at rest, so a LIKE would match ciphertext — see the note on
 * `searchMeetings`. A matched row shows what matched, because a room code and a
 * date are no answer to "which meeting did we discuss the budget in".
 */
export function MeetingHistory({ rows }: { rows: MeetingRow[] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MeetingRow[] | null>(null)
  /** The term `results` belongs to, so a stale term never highlights a row. */
  const [resultTerm, setResultTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [failed, setFailed] = useState(false)
  const [deleted, setDeleted] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  /**
   * Which request is current. Responses can land out of order, so an earlier
   * slow query must not overwrite a later fast one's results.
   */
  const latest = useRef(0)

  const runSearch = async (term: string) => {
    const ticket = (latest.current += 1)
    setSearching(true)
    setFailed(false)
    try {
      const response = await fetch(
        `/api/dashboard/search?q=${encodeURIComponent(term)}`,
      )
      if (!response.ok) throw new Error('Search failed')
      const body = (await response.json()) as { meetings: MeetingRow[] }
      if (ticket !== latest.current) return
      setResults(body.meetings)
      setResultTerm(term)
    } catch {
      if (ticket !== latest.current) return
      // Shown in place of the list rather than only as a toast: a toast leaves
      // an empty list behind, which reads as "nothing matched".
      setFailed(true)
      setResults(null)
    } finally {
      if (ticket === latest.current) setSearching(false)
    }
  }

  const clearSearch = () => {
    latest.current += 1
    setQuery('')
    setResults(null)
    setResultTerm('')
    setFailed(false)
    setSearching(false)
    inputRef.current?.focus()
  }

  // Debounced rather than button-gated: the corpus is one user's own history,
  // scoped by organiser id and capped at 20 rows, so searching as you type is
  // cheap — and having to find a button was half the reported problem.
  useEffect(() => {
    const term = query.trim()
    if (!shouldSearch(term)) {
      // Not a search failure — the query is simply too short to run yet, so the
      // full list comes back rather than an empty result.
      latest.current += 1
      setResults(null)
      setResultTerm('')
      setFailed(false)
      setSearching(false)
      return
    }
    const timer = setTimeout(() => void runSearch(term), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const copyLink = async (id: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/${id}`)
    toast.success('Meeting link copied')
  }

  const remove = async (id: string) => {
    try {
      const response = await fetch(`/api/meetings/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Delete failed')
      // Dropped from both lists, not just hidden: the row is gone server-side,
      // so leaving it in `results` meant a re-search could bring back a
      // meeting that no longer exists.
      setDeleted((current) => new Set(current).add(id))
      setResults((current) =>
        current ? current.filter((row) => row.id !== id) : current,
      )
    } catch {
      toast.error('Could not delete that meeting')
    }
  }

  const isSearch = results !== null
  const visible = (results ?? rows).filter((row) => !deleted.has(row.id))

  return (
    // Named by the Shell's section header, so the search form gets the full
    // row instead of sharing it with a duplicate heading.
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/*
          Still a form, so Enter searches at once instead of waiting out the
          debounce — the only thing the submit button was really providing.
        */}
        <form
          className="flex flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const term = query.trim()
            if (shouldSearch(term)) void runSearch(term)
          }}
        >
          <div className="relative flex-1 sm:max-w-72">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search code, people, or chat"
              aria-label="Search meetings"
              className="h-9 w-full pl-9 pr-16"
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searching ? (
                <Spinner className="size-3.5 text-muted-foreground" />
              ) : null}
              {query ? (
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      </div>

      {/* Announced, because with live search nothing else tells a screen
          reader the list underneath just changed. */}
      <p className="sr-only" role="status" aria-live="polite">
        {searching
          ? 'Searching'
          : isSearch
            ? `${visible.length} ${visible.length === 1 ? 'meeting' : 'meetings'} matched ${resultTerm}`
            : ''}
      </p>

      {failed ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          <p className="text-muted-foreground">Search could not run.</p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => void runSearch(query.trim())}
          >
            Try again
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {isSearch ? (
            <>
              <p>
                No meeting matched{' '}
                <span className="font-medium">{resultTerm}</span>.
              </p>
              {/*
                ADR 0020: an encrypted meeting never stores its chat, so a
                phrase from one is unfindable by design. Saying so here is the
                difference between an honest gap and an apparent bug.
              */}
              <p className="mt-1 text-xs">
                Codes, attendee names, and saved chat are searched. Encrypted
                meetings never save chat, and event titles are encrypted at
                rest, so neither can be searched.
              </p>
            </>
          ) : (
            <p>Meetings you start will appear here.</p>
          )}
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {visible.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{row.id}</span>
                  {row.endedAt ? (
                    <Badge variant="secondary">Ended</Badge>
                  ) : null}
                  {row.eventTitle ? (
                    <span className="truncate text-sm text-muted-foreground">
                      {row.eventTitle}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatDate(row.createdAt)}</span>
                  {row.totalMinutes > 0 ? (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {row.totalMinutes} min
                    </span>
                  ) : null}
                  {row.attendees > 0 ? (
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {row.attendees}
                    </span>
                  ) : null}
                </div>
                <MatchContext matches={row.matches} term={resultTerm} />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn('size-8')}
                  onClick={() => copyLink(row.id)}
                  aria-label={`Copy link for ${row.id}`}
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="size-8" asChild>
                  <a href={`/${row.id}`} aria-label={`Rejoin ${row.id}`}>
                    <Video className="size-3.5" />
                  </a>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => remove(row.id)}
                  aria-label={`Delete ${row.id}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * What matched, under the row it explains.
 *
 * Renders nothing when the only reason was the room code, which is already the
 * row's heading.
 */
function MatchContext({
  matches,
  term,
}: {
  matches?: MeetingMatch[]
  term: string
}) {
  const described = describeMatches(matches ?? [], term)
  if (described.length === 0) return null

  return (
    <ul className="space-y-0.5">
      {described.map((match, index) => (
        <li
          key={`${match.kind}-${index}`}
          className="flex min-w-0 items-baseline gap-1.5 text-xs text-muted-foreground"
        >
          {match.kind === 'attendee' ? (
            <User className="size-3 shrink-0 translate-y-0.5" />
          ) : (
            <MessageSquare className="size-3 shrink-0 translate-y-0.5" />
          )}
          {match.kind === 'chat' ? (
            <span className="shrink-0 font-medium text-foreground/70">
              {match.label}:
            </span>
          ) : null}
          <span className="min-w-0 truncate">
            <Highlighted snippet={match.snippet} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** The matched run marked inside its surrounding text. */
function Highlighted({ snippet }: { snippet: MatchSnippet | null }) {
  if (!snippet) return null
  return (
    <>
      {snippet.before}
      {snippet.match ? (
        <mark className="rounded bg-primary/15 px-0.5 text-foreground">
          {snippet.match}
        </mark>
      ) : null}
      {snippet.after}
    </>
  )
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}
