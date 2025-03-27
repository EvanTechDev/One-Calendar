"use client"

import { useState } from "react"
import { Edit2, Trash2, X, MapPin, Users, Calendar, Bell, AlignLeft, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { zhCN, enUS } from "date-fns/locale"
import { format } from "date-fns"
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
  const [participantsOpen, setParticipantsOpen] = useState(false)

  // If event is null or not open, don't render anything
  if (!event || !open) {
    return null
  }

  // Get calendar name
  const getCalendarName = () => {
    if (!event) return ""
    const calendar = calendars.find((cal) => cal.id === event.calendarId)
    return calendar ? calendar.name : ""
  }

  // Format date range for display - removed weekday
  const formatDateRange = () => {
    const startDate = new Date(event.startDate)
    const endDate = new Date(event.endDate)

    const dateFormat = "yyyy-MM-dd HH:mm"

    const startFormatted = format(startDate, dateFormat, { locale: language === "zh" ? zhCN : enUS })
    const endFormatted = format(endDate, dateFormat, { locale: language === "zh" ? zhCN : enUS })

    return `${startFormatted} – ${endFormatted}`
  }

  // Format notification time
  const formatNotificationTime = () => {
    if (event.notification === 0) {
      return language === "zh" ? "事件开始时" : "At time of event"
    }
    return language === "zh" ? `${event.notification} 分钟前` : `${event.notification} minutes before`
  }

  // Get participant initials for avatar
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase()
  }

  // Check if we have valid participants
  const hasParticipants =
    event.participants && event.participants.length > 0 && event.participants.some((p) => p.trim() !== "")

  // Toggle participants section
  const toggleParticipants = () => {
    setParticipantsOpen(!participantsOpen)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with buttons - increased padding */}
        <div className="flex justify-between items-center p-5">
          <div className="w-24"></div> {/* Empty space for alignment */}
          <div className="flex space-x-2 ml-auto">
            <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
              <Edit2 className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8">
              <Trash2 className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 ml-2">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Event title and date - increased padding */}
        <div className="px-5 pb-5 flex">
          <div className={cn("w-2 self-stretch rounded-full mr-4", event.color)} />
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-1">{event.title}</h2>
            <p className="text-muted-foreground">{formatDateRange()}</p>
          </div>
        </div>

        {/* Event details - increased padding */}
        <div className="px-5 pb-5 space-y-4">
          {/* Location */}
          {event.location && event.location.trim() !== "" && (
            <div className="flex items-start">
              <MapPin className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p>{event.location}</p>
              </div>
            </div>
          )}

          {/* Participants - using manual implementation instead of Collapsible */}
          {hasParticipants && (
            <div className="flex items-start">
              <Users className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center justify-between cursor-pointer" onClick={toggleParticipants}>
                  <p>
                    {event.participants.filter((p) => p.trim() !== "").length}{" "}
                    {language === "zh" ? "参与者" : "participants"}
                  </p>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      participantsOpen ? "transform rotate-180" : "",
                    )}
                  />
                </div>

                {participantsOpen && (
                  <div className="mt-2 space-y-2">
                    {event.participants
                      .filter((p) => p.trim() !== "")
                      .map((participant, index) => (
                        <div key={index} className="flex items-center">
                          <div className="bg-gray-200 rounded-full h-8 w-8 flex items-center justify-center mr-2">
                            <span className="font-medium">{getInitials(participant)}</span>
                          </div>
                          <p>{participant}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Calendar - only show if there's a calendar name */}
          {getCalendarName() && (
            <div className="flex items-start">
              <Calendar className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p>{getCalendarName()}</p>
              </div>
            </div>
          )}

          {/* Notification */}
          {event.notification > 0 && (
            <div className="flex items-start">
              <Bell className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p>{formatNotificationTime()}</p>
                <p className="text-sm text-muted-foreground">
                  {language === "zh"
                    ? `${event.notification} 分钟前 按电子邮件`
                    : `${event.notification} minutes before by email`}
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && event.description.trim() !== "" && (
            <div className="flex items-start">
              <AlignLeft className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p className="whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

