"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import { MapPin, Users, Calendar, Bell, AlignLeft, Loader2, Clock, AlertCircle } from 'lucide-react'
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import { motion } from "framer-motion"

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
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="fixed -z-10 inset-0">
          <div className="absolute inset-0 bg-white dark:bg-black">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />
            <div className="absolute inset-0 dark:block hidden" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />
          </div>
        </div>
        <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
        <p className="mt-6 text-lg font-medium text-gray-600 dark:text-gray-300">
          {language === "zh" ? "加载中..." : "Loading..."}
        </p>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="fixed -z-10 inset-0">
          <div className="absolute inset-0 bg-white dark:bg-black">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />
            <div className="absolute inset-0 dark:block hidden" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />
          </div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="max-w-md w-full overflow-hidden">
            <CardContent className="p-6 text-center">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-full p-4 mx-auto w-fit">
                <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400" />
              </div>

              <CardTitle className="text-2xl font-bold text-red-500 mb-4 mt-4">
                {language === "zh" ? "事件未找到" : "Event Not Found"}
              </CardTitle>
              
              <CardDescription className="text-gray-600 dark:text-gray-300">
                {language === "zh"
                  ? "无法加载共享的日历事件。该链接可能已过期或无效。"
                  : "Unable to load the shared calendar event. The link may be expired or invalid."}
              </CardDescription>
            </CardContent>
          </Card>
        </motion.div>
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
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4">
      <div className="fixed -z-10 inset-0">
        <div className="absolute inset-0 bg-white dark:bg-black">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
          <div className="absolute inset-0 dark:block hidden" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
        </div>
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
        <a 
          href={`${typeof window !== 'undefined' ? window.location.origin : ''}/share/${shareId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 self-center font-medium hover:opacity-80 transition-opacity"
        >
          <Calendar className="size-4" color="#0066ff" />
          One Calendar
        </a>      
      
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="max-w-md w-full overflow-hidden">
            <div className="relative">
              {/* 左侧彩色条 */}
              <div className={cn("absolute left-0 top-0 h-full w-1", event.color)} />
              
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <CardTitle className="text-2xl font-bold mb-1">{event.title}</CardTitle>
                    <CardDescription>
                      {language === "zh" ? "分享者：" : "Shared by: "}
                      <span className="font-medium">{event.sharedBy}</span>
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{durationText}</span>
                  </Badge>
                </div>
                
                {/* 日期时间 */}
                <Card className="bg-muted mb-6">
                  <CardContent className="p-4 flex items-start">
                    <Calendar className="h-5 w-5 mr-3 mt-0.5 text-primary" />
                    <div>
                      <p className="font-medium">{formatDateWithTimezone(event.startDate)}</p>
                      <p className="text-muted-foreground">
                        {language === "zh" ? "至" : "to"} {formatDateWithTimezone(event.endDate)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                
                {/* 详情部分 */}
                <div className="space-y-5">
                  {event.location && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="flex items-start"
                    >
                      <MapPin className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                      <p>{event.location}</p>
                    </motion.div>
                  )}
                  
                  {event.participants?.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                      className="flex items-start"
                    >
                      <Users className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                      <p>{event.participants.join(", ")}</p>
                    </motion.div>
                  )}
                  
                  {event.notification > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.3 }}
                      className="flex items-start"
                    >
                      <Bell className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                      <p>
                        {language === "zh" ? `提前 ${event.notification} 分钟提醒` : `${event.notification} minutes before`}
                      </p>
                    </motion.div>
                  )}
                  
                  {event.description && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.4 }}
                      className="flex items-start"
                    >
                      <AlignLeft className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                      <p className="whitespace-pre-wrap">{event.description}</p>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
