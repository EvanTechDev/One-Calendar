'use client'

import { useState } from 'react'
import { Calendar, Bookmark, MoreVertical } from 'lucide-react'
import { ClockDashed } from '@/components/icons/clock-dashed'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import MiniCalendarSheet from '../mini-calendar-sheet'
import BookmarkPanel from '../bookmark-panel'
import { CountdownTool } from '../countdown'
import { translations, useLanguage } from '@/lib/i18n'

interface MobileRightSidebarProps {
  onEventClick: (event: any) => void
}

export function MobileRightSidebar({ onEventClick }: MobileRightSidebarProps) {
  const [miniCalendarOpen, setMiniCalendarOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [bookmarkPanelOpen, setBookmarkPanelOpen] = useState(false)
  const [countdownOpen, setCountdownOpen] = useState(false)
  const [language] = useLanguage()
  const t = translations[language]

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            aria-label="More tools"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setMiniCalendarOpen(true)}>
            <Calendar className="mr-2 h-4 w-4" />
            {t.calendar}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setBookmarkPanelOpen(true)}>
            <Bookmark className="mr-2 h-4 w-4" />
            {t.bookmarks}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCountdownOpen(true)}>
            <ClockDashed className="mr-2 h-4 w-4" />
            {t.countdownTitle}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MiniCalendarSheet
        open={miniCalendarOpen}
        onOpenChange={setMiniCalendarOpen}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
      />

      <BookmarkPanel
        open={bookmarkPanelOpen}
        onOpenChange={setBookmarkPanelOpen}
        onEventClick={onEventClick}
      />

      <CountdownTool open={countdownOpen} onOpenChange={setCountdownOpen} />
    </>
  )
}
