"use client"

import { useState, useEffect } from "react"
import TimeAnalyticsComponent from "./TimeAnalytics"
import ImportExport from "./ImportExport"
import AnalyticsGuide from "./AnalyticsGuide"
import type { CalendarEvent } from "../Calendar"
import { useCalendar } from "@/components/context/CalendarContext"
import { useLanguage } from "@/hooks/useLanguage"
import { translations } from "@/lib/i18n"
import ShareManagement from "./ShareManagement"
import EventsCalendar from "./EventsCalendar"

interface AnalyticsViewProps {
  events: CalendarEvent[]
  onCreateEvent: (startDate: Date, endDate: Date) => void
  onImportEvents: (events: CalendarEvent[]) => void
}

export default function AnalyticsView({ events, onCreateEvent, onImportEvents }: AnalyticsViewProps) {
  const { calendars } = useCalendar()
  const [language, setLanguage] = useLanguage()
  const t = translations[language]
  // 添加一个状态来强制组件重新渲染
  const [forceUpdate, setForceUpdate] = useState(0)

  // 监听localStorage变化
  useEffect(() => {
    // 创建一个事件监听器，当localStorage变化时触发
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "preferred-language") {
        // 强制组件重新渲染
        setForceUpdate((prev) => prev + 1)
      }
    }

    // 监听语言变化事件
    const handleLanguageChange = () => {
      // 强制组件重新渲染
      setForceUpdate((prev) => prev + 1)
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("languagechange", handleLanguageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("languagechange", handleLanguageChange)
    }
  }, [])

  return (
    <div className="space-y-8 p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t.analytics}</h1>
      </div>
      <AnalyticsGuide />
      <TimeAnalyticsComponent events={events} calendars={calendars} key={`time-analytics-${language}-${forceUpdate}`} />
      <div className="grid grid-cols-1 gap-8">
        <EventsCalendar />
        <ImportExport
          events={events}
          onImportEvents={onImportEvents}
          key={`import-export-${language}-${forceUpdate}`}
        />
        <ShareManagement key={`share-management-${language}-${forceUpdate}`} />
      </div>
    </div>
  )
}

