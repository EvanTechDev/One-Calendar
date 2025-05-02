"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import { MapPin, Users, Calendar, Bell, AlignLeft, Loader2, Clock, CalendarPlus, ExternalLink } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n"
import { translations } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { useCalendar } from "@/components/context/CalendarContext"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"


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
  const { calendars, events, setEvents } = useCalendar()
  const [copied, setCopied] = useState(false)

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
          setError(response.status === 404 ? "Shared event not found" : "Failed to load shared event")
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

  const handleAddToCalendar = async () => {
    if (!event) return

    try {
      setIsAdding(true)

      let targetCalendarId = event.calendarId
      const calendarExists = calendars.some((cal) => cal.id === targetCalendarId)

      if (!calendarExists) {
        targetCalendarId = calendars[0]?.id ?? "default"
      }

      const newEvent = {
        ...event,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
        calendarId: targetCalendarId,
      }

      setEvents([...events, newEvent])

      toast({
        title: language === "zh" ? "添加成功" : "Added Successfully",
        description: language === "zh" ? "事件已添加到您的日历" : "Event has been added to your calendar",
      })

      setTimeout(() => router.push("/"), 1500)
    } catch (error) {
      toast({
        title: language === "zh" ? "添加失败" : "Add Failed",
        description: error instanceof Error ? error.message : language === "zh" ? "未知错误" : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsAdding(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    toast({
      title: language === "zh" ? "链接已复制" : "Link Copied",
      description: language === "zh" ? "分享链接已复制到剪贴板" : "Share link copied to clipboard",
    })
    setTimeout(() => setCopied(false), 2000)
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
        <div className="rounded-xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-500 mb-4">{error || "Event not found"}</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {language === "zh"
              ? "无法加载共享的日历事件。该链接可能已过期或无效。"
              : "Unable to load the shared calendar event. The link may be expired or invalid."}
          </p>
          <Button onClick={() => router.push("/")} className="w-full">
            {language === "zh" ? "返回主页" : "Return to Home"}
          </Button>
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
        
        {/* 操作按钮 */}
        <div className="mt-8 space-y-3">
          <Button
            className="w-full"
            variant="default"
            onClick={handleAddToCalendar}
            disabled={isAdding}
          >
            {isAdding ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {language === "zh" ? "添加中..." : "Adding..."}
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <CalendarPlus className="mr-2 h-5 w-5" />
                {language === "zh" ? "添加到我的日历" : "Add to My Calendar"}
              </span>
            )}
          </Button>
          
          <Button variant="outline" className="w-full" onClick={copyLink}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {copied
              ? language === "zh" ? "已复制!" : "Copied!"
              : language === "zh" ? "复制分享链接" : "Copy Share Link"}
          </Button>
        </div>
      </CardContent>
    </div>
  </Card>
</motion.div>

      <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        {language === "zh" ? "由 One Calendar 提供支持" : "Powered by One Calendar"}
      </p>
    </div>
  )
}
