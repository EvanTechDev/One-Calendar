import {
  Calendar,
  Bookmark,
} from 'lucide-react'
import { ClockDashed } from '@/components/icons/clock-dashed'
import MiniCalendarSheet from './mini-calendar-sheet'
import { Button } from '@/components/ui/button'
import BookmarkPanel from './bookmark-panel'
import { CountdownTool } from './countdown'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface RightSidebarProps {
  onViewChange?: (view: string) => void
  onEventClick: (event: any) => void
}

export default function RightSidebar({
  onViewChange: _onViewChange,
  onEventClick: _onEventClick,
}: RightSidebarProps) {
  const [miniCalendarOpen, setMiniCalendarOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [bookmarkPanelOpen, setBookmarkPanelOpen] = useState(false)
  const [countdownOpen, setCountdownOpen] = useState(false)

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
  }

  return (
    <>
      <div className="w-14 bg-background border-l flex flex-col items-center py-4 absolute right-0 top-16 bottom-0 z-30">
        <div className="flex flex-col items-center space-y-6 flex-1">
          {}
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full size-10"
            onClick={() => setMiniCalendarOpen(true)}
          >
            <Calendar className="h-6 w-6 text-black dark:text-white" />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className="rounded-full size-10"
            onClick={() => setBookmarkPanelOpen(true)}
          >
            <Bookmark className="h-6 w-6 text-black dark:text-white" />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className={cn(
              'rounded-full size-10',
              countdownOpen && 'ring-2 ring-primary',
            )}
            onClick={() => setCountdownOpen(true)}
          >
            <ClockDashed className="h-6 w-6 text-black dark:text-white" />
          </Button>

          <CountdownTool open={countdownOpen} onOpenChange={setCountdownOpen} />
        </div>
      </div>

      {}
      <MiniCalendarSheet
        open={miniCalendarOpen}
        onOpenChange={setMiniCalendarOpen}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
      />

      <BookmarkPanel
        open={bookmarkPanelOpen}
        onOpenChange={setBookmarkPanelOpen}
      />
    </>
  )
}
