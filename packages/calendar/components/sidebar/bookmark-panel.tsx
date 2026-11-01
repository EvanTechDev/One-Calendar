'use client'

import type React from 'react'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@zntr/ui/sheet'
import { Button } from '@zntr/ui/button'
import { ScrollArea } from '@zntr/ui/scroll-area'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Bookmark,
  CalendarArrowDown,
  CalendarArrowUp,
  History,
  Search,
  Trash2,
} from 'lucide-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@zntr/ui/input-group'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@zntr/ui/empty'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { dateLocale } from '#calendar/lib/date-locale'
import { useBookmarks } from '#calendar/components/providers/data-provider'
import {
  eventDataToCalendarEvent,
  useCalendar,
} from '#calendar/components/providers/calendar-context'
import type { CalendarEvent } from '#calendar/lib/calendar-types'
import { DEFAULT_ACCENT, EVENT_BG_TO_ACCENT } from '#calendar/lib/event-colors'
import {
  BOOKMARK_SORT_STORAGE_KEY,
  DEFAULT_BOOKMARK_SORT,
  sortBookmarks,
} from '#calendar/lib/bookmark-sort'
import { useListSort, type ListSortOption } from './list-sort-menu'

interface BookmarkPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEventClick: (event: CalendarEvent) => void
}

interface BookmarkedEvent extends CalendarEvent {
  /** `bookmarked_events.created_at`, and the sort's only "when did this change". */
  bookmarkedAt: string
  eventId: string
}

function getDarkerColorClass(color: string) {
  return EVENT_BG_TO_ACCENT[color] || DEFAULT_ACCENT
}

/**
 * One entry per sort in `lib/bookmark-sort.ts`, carrying the label and the
 * trigger's icon. The trigger shows the ACTIVE sort rather than a generic
 * "sort" glyph, so the list's order is legible from the closed panel.
 */
const SORT_OPTIONS: ListSortOption[] = [
  { value: 'title-asc', labelKey: 'bookmarkSortTitleAsc', Icon: ArrowDownAZ },
  {
    value: 'title-desc',
    labelKey: 'bookmarkSortTitleDesc',
    Icon: ArrowUpAZ,
  },
  {
    value: 'date-desc',
    labelKey: 'bookmarkSortDateDesc',
    Icon: CalendarArrowDown,
  },
  {
    value: 'date-asc',
    labelKey: 'bookmarkSortDateAsc',
    Icon: CalendarArrowUp,
  },
  {
    value: 'created-desc',
    labelKey: 'bookmarkSortBookmarkedDesc',
    Icon: History,
  },
  {
    value: 'created-asc',
    labelKey: 'bookmarkSortBookmarkedAsc',
    Icon: History,
  },
]

/**
 * The bookmark list without its Sheet shell. The desktop right-rail panel and
 * the mobile drawer tab both render this; `onRequestClose` is however the
 * hosting surface dismisses itself before navigating to a clicked event.
 */
export function BookmarkPanelBody({
  onEventClick,
  onRequestClose,
}: {
  onEventClick: (event: CalendarEvent) => void
  onRequestClose: () => void
}) {
  const [language] = useLanguage()
  const t = translations[language]
  const { bookmarks: serverBookmarks, deleteBookmark } = useBookmarks()
  const { events } = useCalendar()
  const [bookmarks, setBookmarks] = useState<BookmarkedEvent[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const { sort, menu: sortMenu } = useListSort(
    SORT_OPTIONS,
    'bookmarkSort',
    BOOKMARK_SORT_STORAGE_KEY,
    DEFAULT_BOOKMARK_SORT,
  )

  useEffect(() => {
    // Joined through a Map, not `events.find` per bookmark: this effect depends
    // on the whole expanded event list, which changes identity on every
    // optimistic save, so the linear scan was bookmarks × occurrences.
    const byId = new Map(events.map((event) => [event.id, event]))
    setBookmarks(
      serverBookmarks.map((bm) => {
        // Bookmarks outside the loaded calendar range still contain wire
        // dates. Use the shared mapper and retain the complete event so both
        // navigation and the preview receive the same shape as grid clicks.
        const event = byId.get(bm.eventId) ?? eventDataToCalendarEvent(bm.event)
        return {
          ...event,
          id: bm.id,
          eventId: bm.eventId,
          title: event.title ?? '',
          bookmarkedAt: bm.createdAt,
        }
      }),
    )
  }, [serverBookmarks, events])

  const formatEventDate = (dateString: string | Date) => {
    const date = new Date(dateString)
    return format(date, 'yyyy-MM-dd HH:mm', { locale: dateLocale(language) })
  }

  const removeBookmark = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
    try {
      await deleteBookmark(id)
    } catch {}
    toast(t.bookmarkRemoved, {
      description: t.eventRemovedFromBookmarks,
    })
  }

  const handleEventClick = (event: BookmarkedEvent) => {
    onRequestClose()
    onEventClick({ ...event, id: event.eventId })
  }

  // The needle is lower-cased once, not once per bookmark per field.
  const needle = searchTerm.toLowerCase()
  const filteredBookmarks = sortBookmarks(
    bookmarks.filter(
      (bookmark) =>
        bookmark.title.toLowerCase().includes(needle) ||
        (bookmark.description &&
          bookmark.description.toLowerCase().includes(needle)),
    ),
    sort,
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="mb-4 flex shrink-0 items-center gap-2">
        <InputGroup className="min-w-0 flex-1">
          <InputGroupAddon>
            <Search className="h-4 w-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder={t.searchBookmarks}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label={t.searchBookmarks}
          />
          <InputGroupAddon align="inline-end">
            <span
              className="rounded-sm bg-muted px-1.5 text-[10px] tabular-nums"
              aria-label={t.bookmarks}
            >
              {filteredBookmarks.length}
            </span>
          </InputGroupAddon>
        </InputGroup>

        {sortMenu}
      </div>

      <ScrollArea className="-mr-4 min-h-0 flex-1 pr-4">
        {filteredBookmarks.length === 0 ? (
          <Empty className="min-h-48 rounded-lg border border-dashed bg-muted/10 p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Bookmark className="h-4 w-4" />
              </EmptyMedia>
              <EmptyTitle className="select-none">{t.bookmarks}</EmptyTitle>
              <EmptyDescription>
                {searchTerm ? t.noMatchingBookmarks : t.noBookmarks}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-2 pb-1">
            {filteredBookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className="group flex min-w-0 items-start overflow-hidden rounded-lg border bg-background transition-colors hover:bg-muted/30 focus-within:border-ring"
              >
                <button
                  type="button"
                  onClick={() => handleEventClick(bookmark)}
                  aria-label={`${bookmark.title}, ${formatEventDate(bookmark.startDate)}`}
                  className="flex min-w-0 flex-1 items-start gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span
                    className="flex w-10 shrink-0 flex-col overflow-hidden rounded-md border bg-muted/20 text-center"
                    aria-hidden="true"
                  >
                    <span className="border-b px-1 py-0.5 text-[9px] font-medium uppercase leading-4 text-muted-foreground">
                      {format(new Date(bookmark.startDate), 'MMM', {
                        locale: dateLocale(language),
                      })}
                    </span>
                    <span
                      className="py-1 text-lg font-medium leading-6 tabular-nums"
                      style={{ color: getDarkerColorClass(bookmark.color) }}
                    >
                      {format(new Date(bookmark.startDate), 'dd')}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className="block truncate text-[13px] font-medium leading-5">
                      {bookmark.title}
                    </span>
                    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: getDarkerColorClass(bookmark.color),
                        }}
                      />
                      <span className="truncate">
                        {bookmark.isAllDay
                          ? t.allDay
                          : format(new Date(bookmark.startDate), 'p', {
                              locale: dateLocale(language),
                            })}{' '}
                        · {format(new Date(bookmark.startDate), 'yyyy')}
                      </span>
                    </span>
                    {bookmark.description && (
                      <span className="mt-2 block truncate text-xs text-muted-foreground">
                        {bookmark.description}
                      </span>
                    )}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="mt-2 mr-1 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={t.removeBookmark}
                  onClick={(e) => removeBookmark(bookmark.id, e)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

export default function BookmarkPanel({
  open,
  onOpenChange,
  onEventClick,
}: BookmarkPanelProps) {
  const [language] = useLanguage()
  const t = translations[language]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] gap-0 p-0 sm:w-[420px]">
        <SheetHeader className="shrink-0 border-b bg-muted/20 p-4 pr-12">
          <SheetTitle className="flex select-none items-center gap-2 text-sm">
            <Bookmark className="size-4" />
            {t.bookmarks}
          </SheetTitle>
        </SheetHeader>

        <BookmarkPanelBody
          onEventClick={onEventClick}
          onRequestClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
