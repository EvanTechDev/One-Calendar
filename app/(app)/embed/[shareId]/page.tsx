"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import { MapPin, Users, Calendar, Bell, Clock, Loader2, AlertCircle } from 'lucide-react'
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

export default function EmbedEventPage({
  params,
}: {
  params: Promise<{ shareId: string }>
}) {
  const [shareId, setShareId] = useState<string>("")
  const [event, setEvent] = useState<SharedEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<"zh" | "en">("en")

  useEffect(() => {
    params.then((p) => setShareId(p.shareId))
  }, [params])

  useEffect(() => {
    const browserLang = navigator.language.toLowerCase()
    setLanguage(browserLang.startsWith("zh") ? "zh" : "en")
  }, [])

  useEffect(() => {
    const fetchSharedEvent = async () => {
      if (!shareId) return
      
      try {
        setLoading(true)
        const response = await fetch(`/api/share?id=${shareId}`)
        
        if (!response.ok) {
          setError(response.status === 404 ? "Event not found" : "Failed to load event")
          return
        }

        const result = await response.json()
        if (!result.success || !result.data) {
          setError("Invalid share data")
          return
        }

        const eventData = typeof result.data === "object" ? result.data : JSON.parse(result.data)
        setEvent(eventData)
      } catch (error) {
        console.error("Error fetching shared event:", error)
        setError("Failed to load event")
      } finally {
        setLoading(false)
      }
    }

    fetchSharedEvent()
  }, [shareId])

  const formatDateWithTimezone = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, "yyyy-MM-dd HH:mm", { locale: language === "zh" ? zhCN : enUS })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] bg-background">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="flex items-center justify-center min-h-[300px] bg-background p-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {language === "zh" ? "事件未找到或已过期" : "Event not found or expired"}
          </p>
        </div>
      </div>
    )
  }

  const startDate = new Date(event.startDate)
  const endDate = new Date(event.endDate)
  const durationMs = endDate.getTime() - startDate.getTime()
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60))
  const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

  const durationText =
    language === "zh"
      ? `${durationHours > 0 ? `${durationHours}小时` : ""}${durationMinutes > 0 ? ` ${durationMinutes}分钟` : ""}`
      : `${durationHours > 0 ? `${durationHours}h` : ""}${durationMinutes > 0 ? ` ${durationMinutes}m` : ""}`

  return (
    <div className="min-h-screen bg-background p-3">
      <Card className="w-full max-w-2xl mx-auto shadow-lg hover:shadow-xl transition-shadow">
        <div className="relative">
          <div className={cn("absolute left-0 top-0 h-1 w-full rounded-t-lg", event.color)} />
          
          <CardContent className="p-5">
            <div className="flex justify-between items-start gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold mb-1 truncate">{event.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {language === "zh" ? "分享者：" : "Shared by: "}
                  <span className="font-medium">{event.sharedBy}</span>
                </p>
              </div>
              {durationText && (
                <Badge variant="secondary" className="flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">{durationText}</span>
                </Badge>
              )}
            </div>

            <div className="bg-muted rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="text-sm min-w-0">
                  <p className="font-medium">{formatDateWithTimezone(event.startDate)}</p>
                  <p className="text-muted-foreground">
                    {language === "zh" ? "至" : "to"} {formatDateWithTimezone(event.endDate)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              {event.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-foreground break-words">{event.location}</p>
                </div>
              )}
              
              {event.participants?.length > 0 && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-foreground break-words">{event.participants.join(", ")}</p>
                </div>
              )}
              
              {event.notification > 0 && (
                <div className="flex items-start gap-2">
                  <Bell className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-foreground">
                    {language === "zh" ? `提前 ${event.notification} 分钟提醒` : `${event.notification} min before`}
                  </p>
                </div>
              )}
              
              {event.description && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-foreground whitespace-pre-wrap break-words text-sm">
                    {event.description}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <a
                href={`${window.location.origin}/share/${shareId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                <Calendar className="h-3.5 w-3.5" />
                {language === "zh" ? "查看完整详情并添加到日历" : "View full details and add to calendar"}
              </a>
            </div>
          </CardContent>
        </div>
      </Card>

      <div className="text-center mt-3 mb-2">
        <a
          href={window.location.origin}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <Calendar className="h-3 w-3" />
          <span>Powered by One Calendar</span>
        </a>
      </div>
    </div>
  )
}
