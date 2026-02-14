"use client"

import TimeAnalyticsComponent from "@/components/app/analytics/time-analytics"
import EventsCalendar from "@/components/app/analytics/events-calendar"
import { useCalendar } from "@/components/providers/calendar-context"
import type { CalendarEvent } from "@/components/app/calendar"
import { translations, useLanguage } from "@/lib/i18n"
import { useState, useEffect } from "react"

interface AnalyticsViewProps {
  events: CalendarEvent[]
  onCreateEvent: (startDate: Date, endDate: Date) => void
}

export default function AnalyticsView({ events }: AnalyticsViewProps) {
  const { calendars } = useCalendar()
  const [language] = useLanguage()
  const t = translations[language]
  const [forceUpdate, setForceUpdate] = useState(0)

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "preferred-language") {
        setForceUpdate((prev) => prev + 1)
      }
    }

    const handleLanguageChange = () => {
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
      <TimeAnalyticsComponent events={events} calendars={calendars} key={`time-analytics-${language}-${forceUpdate}`} />
      <EventsCalendar />
    </div>
  )
}
