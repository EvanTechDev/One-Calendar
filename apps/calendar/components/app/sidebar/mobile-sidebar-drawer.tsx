'use client'

import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import { ClockDashed } from '@/components/icons/clock-dashed'
import { Sheet, SheetContent, SheetTitle } from '@zntr/ui/sheet'
import { cn } from '@zntr/utils'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { SidebarBody } from './sidebar'
import { BookmarkPanelBody } from './bookmark-panel'
import { CountdownBody } from './countdown'
import type { ViewType } from '@/lib/calendar-types'
import type { Language } from '@zntr/i18n/calendar'

interface MobileSidebarDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateEvent: () => void
  onDateSelect: (date: Date) => void
  onViewChange?: (view: ViewType) => void
  onEventClick: (event: any) => void
  language?: Language
  selectedDate?: Date
  selectedCategoryFilters?: string[]
  onCategoryFilterChange?: (categoryId: string, checked: boolean) => void
}

type DrawerTab = 'calendar' | 'bookmarks' | 'countdown'

/**
 * The Mobile Form's single left drawer (ADR-0019): the sidebar content on
 * top, and at the bottom two tabs — Bookmarks and Countdown — that switch
 * the panel shown inside this same sheet. There is no mobile right sidebar.
 *
 * Mobile-only by construction: the desktop shell renders it alongside the
 * desktop sidebar, but it can only be opened from the hamburger button,
 * which itself exists only below the `md` breakpoint.
 */
export default function MobileSidebarDrawer({
  open,
  onOpenChange,
  onCreateEvent,
  onDateSelect,
  onViewChange,
  onEventClick,
  language,
  selectedDate,
  selectedCategoryFilters,
  onCategoryFilterChange,
}: MobileSidebarDrawerProps) {
  const [lang] = useLanguage()
  const t = translations[lang]
  const [tab, setTab] = useState<DrawerTab>('calendar')

  const close = () => onOpenChange(false)

  const tabs: { id: DrawerTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'bookmarks',
      label: t.bookmarks,
      icon: <Bookmark className="h-4 w-4" />,
    },
    {
      id: 'countdown',
      label: t.countdownTitle,
      icon: <ClockDashed className="h-4 w-4" />,
    },
  ]

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        // Reopening always lands on the main panel, matching the drawer
        // pattern this mirrors: tabs are transient detours, not modes.
        if (!next) setTab('calendar')
      }}
    >
      <SheetContent side="left" className="flex w-[300px] flex-col gap-0 p-0">
        <SheetTitle className="sr-only">Zentra Calendar</SheetTitle>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'calendar' && (
            <SidebarBody
              onCreateEvent={() => {
                close()
                onCreateEvent()
              }}
              onDateSelect={(date) => {
                close()
                onDateSelect(date)
              }}
              onViewChange={onViewChange}
              language={language}
              selectedDate={selectedDate}
              selectedCategoryFilters={selectedCategoryFilters}
              onCategoryFilterChange={onCategoryFilterChange}
            />
          )}
          {tab === 'bookmarks' && (
            <BookmarkPanelBody
              onEventClick={onEventClick}
              onRequestClose={close}
            />
          )}
          {tab === 'countdown' && <CountdownBody />}
        </div>

        {/* Bottom tab rail, styled after the settings dialog's section tabs. */}
        <nav className="flex shrink-0 gap-1 border-t p-2">
          {tabs.map((item) => {
            const active = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(active ? 'calendar' : item.id)}
                aria-pressed={active}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className="shrink-0 [&_svg]:size-4">{item.icon}</span>
                <span className="min-w-0 truncate">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
