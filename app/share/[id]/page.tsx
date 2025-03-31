"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import { MapPin, Users, Calendar, Bell, AlignLeft, Plus, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n"
import { translations } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { useCalendar } from "@/contexts/CalendarContext"

interface SharedEvent {
  id: string
  title: string
  startDate: string
  endDate: string
  isAllDay: boolean
  location?: string
  participants: string[]
  notification: number
  description?: string
  color: string
  calendarId: string
  sharedBy: string
}

export default function SharedEventPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [language] = useLanguage()
  const t = translations[language]
  const [event, setEvent] = useState<SharedEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const { calendars, addEvent } = useCalendar()

  useEffect(() => {
    const fetchSharedEvent = async () => {
      try {
        setLoading(true)
        const shareId = params.id

        if (!shareId) {
          setError("No share ID provided")
          return
        }

        const response = await fetch(`/api/share?id=${shareId}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError("Shared event not found")
          } else {
            setError("Failed to load shared event")
          }
          return
        }

        const result = await response.json()

        if (!result.success || !result.data) {
          setError("Invalid share data")
          return
        }

        // Parse the shared event data
        let eventData
        try {
          if (typeof result.data === "object") {
            eventData = result.data
          } else {
            eventData = JSON.parse(result.data)
          }
          setEvent(eventData)
        } catch (parseError) {
          console.error("Error parsing shared event:", parseError)
          setError("Invalid event data format")
        }
      } catch (error) {
        console.error("Error fetching shared event:", error)
        setError("Failed to load shared event")
      } finally {
        setLoading(false)
      }
    }

    fetchSharedEvent()
  }, [params.id])

  const formatDateWithTimezone = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, "yyyy-MM-dd HH:mm", { locale: language === "zh" ? zhCN : enUS })
  }

  // 添加事件到日历
  const handleAddToCalendar = async () => {
    if (!event) return

    try {
      setIsAdding(true)

      // 如果没有日历，使用默认日历或创建一个新的
      let targetCalendarId = event.calendarId

      // 检查日历是否存在
      const calendarExists = calendars.some((cal) => cal.id === targetCalendarId)

      // 如果不存在，使用第一个可用的日历或默认日历
      if (!calendarExists) {
        if (calendars.length > 0) {
          targetCalendarId = calendars[0].id
        } else {
          // 如果没有日历，使用默认日历ID
          targetCalendarId = "default"
        }
      }

      // 创建新的事件对象
      const newEvent = {
        ...event,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // 生成新的ID
        calendarId: targetCalendarId,
      }

      // 添加到日历
      addEvent(newEvent)

      toast({
        title: language === "zh" ? "添加成功" : "Added Successfully",
        description: language === "zh" ? "事件已添加到您的日历" : "Event has been added to your calendar",
      })

      // 可选：添加成功后跳转到日历页面
      setTimeout(() => {
        router.push("/")
      }, 1500)
    } catch (error) {
      console.error("Error adding event to calendar:", error)
      toast({
        title: language === "zh" ? "添加失败" : "Add Failed",
        description: error instanceof Error ? error.message : language === "zh" ? "未知错误" : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
        <p className="mt-4 text-gray-600">{language === "zh" ? "加载中..." : "Loading..."}</p>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold text-red-500 mb-4">{error || "Event not found"}</h1>
        <p className="text-gray-600">
          {language === "zh"
            ? "无法加载共享的日历事件。该链接可能已过期或无效。"
            : "Unable to load the shared calendar event. The link may be expired or invalid."}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden">
        {/* Header with event color */}
        <div className={cn("h-2 w-full", event.color)}></div>

        {/* Event title and shared by info */}
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-1">{event.title}</h1>
          <p className="text-sm text-gray-500 mb-4">
            {language === "zh" ? "分享者：" : "Shared by: "}
            {event.sharedBy}
          </p>

          {/* Date and time */}
          <div className="flex items-start mb-4">
            <Calendar className="h-5 w-5 mr-3 mt-0.5 text-gray-500" />
            <div>
              <p>
                {formatDateWithTimezone(event.startDate)} - {formatDateWithTimezone(event.endDate)}
              </p>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start mb-4">
              <MapPin className="h-5 w-5 mr-3 mt-0.5 text-gray-500" />
              <div>
                <p>{event.location}</p>
              </div>
            </div>
          )}

          {/* Participants */}
          {event.participants && event.participants.length > 0 && (
            <div className="flex items-start mb-4">
              <Users className="h-5 w-5 mr-3 mt-0.5 text-gray-500" />
              <div>
                <p>{event.participants.join(", ")}</p>
              </div>
            </div>
          )}

          {/* Notification */}
          {event.notification > 0 && (
            <div className="flex items-start mb-4">
              <Bell className="h-5 w-5 mr-3 mt-0.5 text-gray-500" />
              <div>
                <p>
                  {language === "zh" ? `提前 ${event.notification} 分钟提醒` : `${event.notification} minutes before`}
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start mb-6">
              <AlignLeft className="h-5 w-5 mr-3 mt-0.5 text-gray-500" />
              <div>
                <p className="whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>
          )}

          {/* Add to Calendar Button */}
          <Button className="w-full" onClick={handleAddToCalendar} disabled={isAdding}>
            {isAdding ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {language === "zh" ? "添加中..." : "Adding..."}
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <Plus className="mr-2 h-4 w-4" />
                {language === "zh" ? "添加到我的日历" : "Add to My Calendar"}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

