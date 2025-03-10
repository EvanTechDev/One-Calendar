"use client"

import TimeAnalyticsComponent from "./TimeAnalytics"
import ImportExport from "./ImportExport"
import AnalyticsGuide from "./AnalyticsGuide"
import type { CalendarEvent } from "./Calendar"
import { useCalendar } from "@/contexts/CalendarContext"
import { useLanguage } from "@/lib/i18n"
import { translations } from "@/lib/i18n"

interface AnalyticsViewProps {
  events: CalendarEvent[]
  onCreateEvent: (startDate: Date, endDate: Date) => void
  onImportEvents: (events: CalendarEvent[]) => void
}

export default function AnalyticsView({ events, onCreateEvent, onImportEvents }: AnalyticsViewProps) {
  const { calendars } = useCalendar()
  const [language] = useLanguage()
  const t = translations[language]

  return (
    <div className="space-y-8 p-4">
      <AnalyticsGuide />
      <TimeAnalyticsComponent events={events} calendars={calendars} />
      <div className="grid grid-cols-1 gap-8">
        <ImportExport events={events} onImportEvents={onImportEvents} />
      </div>
    </div>
  )
}

