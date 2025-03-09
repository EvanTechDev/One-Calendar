"use client"

import { Edit2, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { zhCN, enUS } from "date-fns/locale"
import type { CalendarEvent } from "./Calendar"
import type { Language } from "@/lib/i18n"
import { translations } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useCalendar } from "@/contexts/CalendarContext"

interface EventPreviewProps {
  event: CalendarEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  language: Language
  timezone: string
}

export default function EventPreview({
  event,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onDuplicate,
  language,
  timezone,
}: EventPreviewProps) {
  const { calendars } = useCalendar()
  const t = translations[language]
  const locale = language === "zh" ? zhCN : enUS

  // If event is null or not open, don't render anything
  if (!event || !open) {
    return null
  }

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }
    return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", options).format(new Date(date))
  }

  // 修改 getCalendarName 函数
  const getCalendarName = () => {
    if (!event) return ""
    const calendar = calendars.find((cal) => cal.id === event.calendarId)
    return calendar ? calendar.name : event.calendarId
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => onOpenChange(false)}
    >
      <Card className="w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row justify-between items-start pb-2">
          <CardTitle className="text-xl font-bold">{event.title}</CardTitle>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="h-8 w-8"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 日期和时间总是显示 */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">{t.dateAndTime || "Date and Time"}</div>
            <div className="font-medium">
              {formatDate(event.startDate)}
              {" - "}
              {formatDate(event.endDate)}
            </div>
          </div>

          {/* 只有当location存在且不为空时才显示 */}
          {event.location && event.location.trim() !== "" && (
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">{t.location}</div>
              <div className="font-medium">{event.location}</div>
            </div>
          )}

          {/* 只有当description存在且不为空时才显示 */}
          {event.description && event.description.trim() !== "" && (
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">{t.description}</div>
              <div className="font-medium whitespace-pre-wrap">{event.description}</div>
            </div>
          )}

          {/* 日历分类总是显示 */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">{t.calendar}</div>
            <div className="flex items-center">
              <div className={cn("w-3 h-3 rounded-full mr-2", event.color)} />
              <span className="font-medium">{getCalendarName()}</span>
            </div>
          </div>

          {/* 只有当participants数组不为空时才显示 */}
          {event.participants && event.participants.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">{t.participants}</div>
              <div className="font-medium">
                {event.participants.map((participant, index) => (
                  <div key={index}>{participant}</div>
                ))}
              </div>
            </div>
          )}

          {/* 只有当notification大于0时才显示 */}
          {event.notification > 0 && (
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">{t.notification}</div>
              <div className="font-medium">
                {event.notification === 0
                  ? t.atEventTime
                  : t.minutesBefore.replace("{minutes}", event.notification.toString())}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

