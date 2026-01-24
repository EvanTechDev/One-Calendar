import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ClockDashed } from "@/components/icons/clock-dashed"
import { User, BookText, Plus, ArrowLeft, BarChart2, Edit2, Trash2, Calendar, Bookmark, MessageSquare, Sun } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { translations, useLanguage } from "@/lib/i18n"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import MiniCalendarSheet from "./MiniCalendarSheet"
import BookmarkPanel from "./BookmarkPanel"
import { useRouter } from "next/navigation"
import { CountdownTool } from "./Countdown"

const colorOptions = [
  { value: "bg-blue-500", label: "Blue" },
  { value: "bg-green-500", label: "Green" },
  { value: "bg-purple-500", label: "Purple" },
  { value: "bg-yellow-500", label: "Yellow" },
  { value: "bg-red-500", label: "Red" },
  { value: "bg-pink-500", label: "Pink" },
  { value: "bg-indigo-500", label: "Indigo" },
  { value: "bg-orange-500", label: "Orange" },
  { value: "bg-teal-500", label: "Teal" },
]


interface RightSidebarProps {
  onViewChange?: (view: string) => void
  onEventClick: (event: any) => void
}

export default function RightSidebar({ onViewChange, onEventClick }: RightSidebarProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const [miniCalendarOpen, setMiniCalendarOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [bookmarkPanelOpen, setBookmarkPanelOpen] = useState(false)
  const [countdownOpen, setCountdownOpen] = useState(false);
  const router = useRouter();

  // 处理分析按钮点击
  const handleAnalyticsClick = () => {
    if (onViewChange) {
      onViewChange("analytics")
    }
  }

  // 处理日期选择
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
  }

  return (
    <>
      {/* 右侧图标栏 - 固定在右侧 */}
      <div className="w-14 bg-background border-l flex flex-col items-center py-4 absolute right-0 top-16 bottom-0 z-30">
        <div className="flex flex-col items-center space-y-6 flex-1">
          {/* Mini Calendar Button */}
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
          
          {/* <Button
            variant="ghost"
            size="icon"
            className="rounded-full p-0 w-12 h-12 flex items-center justify-center"
            onClick={() => setContactsOpen(true)}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center bg-blue-500",
                contactsOpen && "ring-2 ring-primary",
              )}
            >
              <User className="h-6 w-6 text-white dark:text-white" />
            </div>
          </Button> */}

          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "rounded-full size-10",
              countdownOpen && "ring-2 ring-primary"
            )}
            onClick={() => setCountdownOpen(true)}
          >
            <ClockDashed className="h-6 w-6 text-black dark:text-white" />
          </Button>

          <CountdownTool open={countdownOpen} onOpenChange={setCountdownOpen} />

          <Button
            variant="secondary"
            size="icon"
            className="rounded-full size-10"
            onClick={handleAnalyticsClick}
          >
            <BarChart2 className="h-6 w-6 text-black dark:text-white" />
          </Button>
          

      {/* Mini Calendar Sheet */}
      <MiniCalendarSheet
        open={miniCalendarOpen}
        onOpenChange={setMiniCalendarOpen}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
      />
      {/* Add the BookmarkPanel component at the end of the return statement, before the closing fragment */}
      <BookmarkPanel open={bookmarkPanelOpen} onOpenChange={setBookmarkPanelOpen} />
    </>
  )
}

