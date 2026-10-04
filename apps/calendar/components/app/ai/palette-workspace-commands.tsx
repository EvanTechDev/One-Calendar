'use client'

import {
  Bookmark,
  CalendarDays,
  ChevronRight,
  Copy,
  Filter,
  Monitor,
  Moon,
  Pencil,
  Sun,
} from 'lucide-react'
import { CommandGroup, CommandItem, commandFilter } from '@zntr/ui/command'
import type { CalendarEvent } from '@/lib/calendar-types'
import type { translations } from '@zntr/i18n/calendar'

export type CommandPage =
  | { type: 'event'; event: CalendarEvent }
  | { type: 'bookmarks' | 'calendars' | 'theme' }
export interface WorkspaceCommands {
  currentEvent?: CalendarEvent | null
  bookmarkedIds: string[]
  calendars: { id: string; name: string }[]
  editEvent: (event: CalendarEvent) => void
  duplicateEvent: (event: CalendarEvent) => void
  toggleBookmark: (event: CalendarEvent) => void
  filterCalendar: (id: string | null) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export function PaletteWorkspaceCommands({
  t,
  events,
  query,
  page,
  navigate,
  workspace,
  run,
  preview,
}: {
  t: (typeof translations)[keyof typeof translations]
  events: CalendarEvent[]
  query: string
  page: CommandPage | null
  navigate: (page: CommandPage) => void
  workspace: WorkspaceCommands
  run: (fn: () => void) => void
  preview: (event: CalendarEvent) => void
}) {
  if (page?.type === 'event') {
    const event = page.event
    return (
      <CommandGroup heading={event.title}>
        <CommandItem onSelect={() => preview(event)}>
          <CalendarDays />
          {t.aiSearchOpen}
        </CommandItem>
        {!event.viewOnly && (
          <CommandItem onSelect={() => run(() => workspace.editEvent(event))}>
            <Pencil />
            {t.edit}
          </CommandItem>
        )}
        <CommandItem
          onSelect={() => run(() => workspace.duplicateEvent(event))}
        >
          <Copy />
          {t.commandDuplicate}
        </CommandItem>
        <CommandItem
          onSelect={() => run(() => workspace.toggleBookmark(event))}
        >
          <Bookmark />
          {workspace.bookmarkedIds.includes(event.id)
            ? t.removeBookmark
            : t.bookmark}
        </CommandItem>
      </CommandGroup>
    )
  }
  if (page?.type === 'theme')
    return (
      <CommandGroup heading={t.theme}>
        {(['light', 'dark', 'system'] as const).map((theme, index) => {
          const Icon = [Sun, Moon, Monitor][index]
          return (
            <CommandItem
              key={theme}
              onSelect={() => run(() => workspace.setTheme(theme))}
            >
              <Icon />
              {[t.themeLight, t.themeDark, t.themeSystem][index]}
            </CommandItem>
          )
        })}
      </CommandGroup>
    )
  if (page?.type === 'calendars')
    return (
      <CommandGroup heading={t.commandFilterCalendar}>
        <CommandItem onSelect={() => run(() => workspace.filterCalendar(null))}>
          <Filter />
          {t.commandAllCalendars}
        </CommandItem>
        {workspace.calendars.map((calendar) => (
          <CommandItem
            key={calendar.id}
            value={`calendar:${calendar.id}`}
            keywords={[calendar.name]}
            onSelect={() => run(() => workspace.filterCalendar(calendar.id))}
          >
            <CalendarDays />
            {calendar.name}
          </CommandItem>
        ))}
      </CommandGroup>
    )

  const candidates = events.filter(
    (event) =>
      page?.type !== 'bookmarks' || workspace.bookmarkedIds.includes(event.id),
  )
  const matches = query.trim()
    ? candidates.filter(
        (event) =>
          commandFilter(event.title, query.trim(), [
            event.location ?? '',
            event.description ?? '',
          ]) > 0,
      )
    : candidates.filter(
        (event) => page || new Date(event.endDate).getTime() >= Date.now(),
      )
  const selected = matches
    .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
    .slice(0, page ? matches.length : query ? 20 : 5)
  const current = workspace.currentEvent
  if (!page && current && !selected.some((event) => event.id === current.id))
    selected.unshift(current)
  return (
    <>
      {!page && (
        <CommandGroup heading={t.commandWorkspace}>
          <CommandItem onSelect={() => navigate({ type: 'bookmarks' })}>
            <Bookmark />
            {t.bookmarks}
            <ChevronRight className="ml-auto" />
          </CommandItem>
          <CommandItem onSelect={() => navigate({ type: 'calendars' })}>
            <Filter />
            {t.commandFilterCalendar}
            <ChevronRight className="ml-auto" />
          </CommandItem>
          <CommandItem onSelect={() => navigate({ type: 'theme' })}>
            <Monitor />
            {t.theme}
            <ChevronRight className="ml-auto" />
          </CommandItem>
        </CommandGroup>
      )}
      <CommandGroup
        heading={
          page ? t.bookmarks : query ? t.searchEvents : t.commandUpcoming
        }
      >
        {selected.map((event) => (
          <CommandItem
            key={event.id}
            value={`event-actions:${event.id}`}
            keywords={[
              event.title,
              event.location ?? '',
              event.description ?? '',
            ]}
            onSelect={() => navigate({ type: 'event', event })}
          >
            <CalendarDays />
            <span className="min-w-0 flex-1 truncate">{event.title}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(event.startDate).toLocaleDateString()}
            </span>
            <ChevronRight />
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  )
}
