import { Bookmark } from 'lucide-react'
import { ClockDashed } from '@/components/icons/clock-dashed'
import { Button } from '@zntr/ui/button'
import BookmarkPanel from './bookmark-panel'
import { CountdownTool } from './countdown'
import { useState } from 'react'
import { cn } from '@zntr/utils'

import type { ViewType } from '@/lib/calendar-types'

interface RightSidebarProps {
  onViewChange?: (view: ViewType) => void
  onEventClick: (event: any) => void
}

export default function RightSidebar({
  onViewChange: _onViewChange,
  onEventClick,
}: RightSidebarProps) {
  const [bookmarkPanelOpen, setBookmarkPanelOpen] = useState(false)
  const [countdownOpen, setCountdownOpen] = useState(false)

  return (
    <>
      <div className="w-14 bg-background border-l flex flex-col items-center py-4 absolute right-0 top-16 bottom-0 z-30">
        <div className="flex flex-col items-center space-y-6 flex-1">
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

      <BookmarkPanel
        open={bookmarkPanelOpen}
        onOpenChange={setBookmarkPanelOpen}
        onEventClick={onEventClick}
      />
    </>
  )
}
