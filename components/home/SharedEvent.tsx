"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import { 
  MapPin, 
  Users, 
  Calendar, 
  Bell, 
  AlignLeft, 
  Loader2, 
  Clock, 
  CalendarPlus, 
  ExternalLink,
  AlertCircle,
  Home,
  Search
} from "lucide-react"
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

interface SharedEventViewProps {
  shareId: string
}

export default function SharedEventView({ shareId }: SharedEventViewProps) {
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
  }, [shareId])

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

  // 背景组件
  const Background = () => (
    <div className="fixed -z-10 inset-0">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-black dark:to-purple-900">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.05) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
        <div className="absolute inset-0 dark:block hidden" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.1) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
      </div>
    </div>
  )

  // 加载状态
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Background />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-400/20 rounded-full animate-ping" />
            <Loader2 className="h-16 w-16 text-blue-500 dark:text-blue-400 animate-spin relative z-10" />
          </div>
          <p className="text-xl font-medium text-gray-700 dark:text-gray-200 mb-2">
            {language === "zh" ? "正在加载事件..." : "Loading event..."}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {language === "zh" ? "请稍候片刻" : "Please wait a moment"}
          </p>
        </motion.div>
      </div>
    )
  }

  // 错误状态
  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Background />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-lg w-full"
        >
          <Card className="relative overflow-hidden border-0 shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
            {/* 装饰性背景 */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-400 via-pink-400 to-purple-400" />
            
            <CardContent className="p-8 text-center">
              {/* 错误图标 */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="relative mb-6"
              >
                <div className="absolute inset-0 bg-red-100 dark:bg-red-900/30 rounded-full animate-pulse" />
                <div className="relative bg-red-50 dark:bg-red-900/50 rounded-full p-4 mx-auto w-fit">
                  <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400" />
                </div>
              </motion.div>

              {/* 错误标题 */}
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-gray-900 dark:text-white mb-3"
              >
                {language === "zh" ? "事件未找到" : "Event Not Found"}
              </motion.h1>

              {/* 错误描述 */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed"
              >
                {language === "zh"
                  ? "抱歉，无法找到您要查看的日历事件。该分享链接可能已过期、被删除或者输入有误。"
                  : "Sorry, we couldn't find the calendar event you're looking for. The share link may have expired, been deleted, or entered incorrectly."}
              </motion.p>

              {/* 建议操作 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-4"
              >
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">
                    {language === "zh" ? "您可以尝试：" : "You can try:"}
                  </p>
                  <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1 text-left">
                    <li>• {language === "zh" ? "检查链接是否完整和正确" : "Check if the link is complete and correct"}</li>
                    <li>• {language === "zh" ? "联系分享者重新发送链接" : "Contact the sharer to resend the link"}</li>
                    <li>• {language === "zh" ? "确认事件是否仍在有效期内" : "Confirm if the event is still valid"}</li>
                  </ul>
                </div>

                {/* 操作按钮 */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={() => router.push("/")} 
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0"
                  >
                    <Home className="mr-2 h-4 w-4" />
                    {language === "zh" ? "返回首页" : "Back to Home"}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.reload()}
                    className="flex-1 border-gray-300 dark:border-gray-600"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    {language === "zh" ? "重新加载" : "Reload"}
                  </Button>
                </div>
              </motion.div>
            </CardContent>
          </Card>

          {/* 底部提示 */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6"
          >
            {language === "zh" ? "需要帮助？请联系客服支持" : "Need help? Contact support"}
          </motion.p>
        </motion.div>
      </div>
    )
  }

  // 成功状态 - 显示事件详情
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
      <Background />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="max-w-md w-full overflow-hidden shadow-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-0">
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
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0"
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
