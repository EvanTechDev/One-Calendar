'use client'

import { useMemo } from 'react'
import { LandingDemo } from '@zntr/shared/calendar/components/calendar'
import {
  DEMO_CATEGORIES,
  landingDemoDate,
  landingDemoEvents,
} from '@/lib/landing-demo'

export function LandingCalendarPreview() {
  const events = useMemo(landingDemoEvents, [])
  const categories = useMemo(
    () =>
      DEMO_CATEGORIES.map(({ id, label, color }) => ({
        id,
        name: label,
        color,
      })),
    [],
  )
  const date = useMemo(landingDemoDate, [])

  return (
    <LandingDemo
      events={events}
      categories={categories}
      date={date}
      view="week"
      className="h-full landing-demo-orange"
    />
  )
}
