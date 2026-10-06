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
import { cn } from '@zntr/utils'
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
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <InputGroup className="min-w-0 flex-1">
          <InputGroupAddon>
            <Search className="h-4 w-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder={t.searchBookmarks}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>

        {sortMenu}
      </div>

      {/* `-mr-4` pulls the scroll area out to the panel edge, so the 10px
          scrollbar it renders internally sits in the gutter rather than
          pushing the rows inward; `pr-4` hands that gutter back to the rows.
          Without the pair a row ends 32px from the edge against the header's
          16px, and the rows look short on the right for no visible reason. */}
      <ScrollArea className="-mr-4 h-[calc(100vh-180px)] pr-4">
        {filteredBookmarks.length === 0 ? (
          <Empty className="h-32 border-0 p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Bookmark className="h-4 w-4" />
              </EmptyMedia>
              <EmptyTitle>{t.bookmarks}</EmptyTitle>
              <EmptyDescription>
                {searchTerm ? t.noMatchingBookmarks : t.noBookmarks}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-3">
            {filteredBookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className="flex items-start p-3 border rounded-md hover:bg-accent cursor-pointer group"
                onClick={() => handleEventClick(bookmark)}
              >
                <div
                  className={cn('w-1.5 self-stretch rounded-full mr-3')}
                  style={{
                    backgroundColor: getDarkerColorClass(bookmark.color),
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{bookmark.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {formatEventDate(bookmark.startDate)}
                  </p>
                  {bookmark.description && (
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {bookmark.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={t.removeBookmark}
                  onClick={(e) => removeBookmark(bookmark.id, e)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
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
      <SheetContent side="right" className="w-[360px] sm:w-[420px] p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center">
            <Bookmark className="mr-2 h-5 w-5" />
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
