'use client'

import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import type { CalendarEvent } from '@/components/app/calendar'
import { isTouchInteraction } from '@/lib/mobile-viewport'

export interface EventResizeState {
  event: CalendarEvent
  edge: 'start' | 'end'
  liveStart: number
  liveEnd: number
}

interface UseEventResizeOptions {
  onEventDrop?: (
    event: CalendarEvent,
    newStartDate: Date,
    newEndDate: Date,
  ) => void
  getMinutesFromMousePosition: (clientY: number) => number
}

const MIN_DURATION_MINUTES = 30
const MOVE_THRESHOLD_PX = 3

export function useEventResize({
  onEventDrop,
  getMinutesFromMousePosition,
}: UseEventResizeOptions) {
  const [resize, setResize] = useState<EventResizeState | null>(null)
  const suppressClickRef = useRef(false)
  const gestureRef = useRef<{
    event: CalendarEvent
    edge: 'start' | 'end'
    day: Date
    originalStart: number
    originalEnd: number
    liveStart: number
    liveEnd: number
    startClientY: number
    active: boolean
  } | null>(null)
  const callbacksRef = useRef({ onEventDrop, getMinutesFromMousePosition })
  useEffect(() => {
    callbacksRef.current = { onEventDrop, getMinutesFromMousePosition }
  })

  const beginResize = (
    event: CalendarEvent,
    edge: 'start' | 'end',
    e: React.MouseEvent,
    day: Date,
    startMinutes: number,
    endMinutes: number,
  ) => {
    if (event.viewOnly) return
    // Touch (ADR-0019): resizing with a finger fights scrolling, so it is
    // disabled — duration changes go through the edit form. The mousedown
    // still must not bubble, or the grid underneath starts its own gesture.
    // Mouse resizing keeps working at every width.
    if (isTouchInteraction()) {
      e.stopPropagation()
      return
    }
    e.stopPropagation()
    gestureRef.current = {
      event,
      edge,
      day,
      originalStart: startMinutes,
      originalEnd: endMinutes,
      liveStart: startMinutes,
      liveEnd: endMinutes,
      startClientY: e.clientY,
      active: false,
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const g = gestureRef.current
      if (!g) return
      if (
        !g.active &&
        Math.abs(e.clientY - g.startClientY) < MOVE_THRESHOLD_PX
      ) {
        return
      }
      g.active = true

      const minutes = callbacksRef.current.getMinutesFromMousePosition(
        e.clientY,
      )
      if (g.edge === 'start') {
        g.liveStart = Math.min(minutes, g.originalEnd - MIN_DURATION_MINUTES)
      } else {
        g.liveEnd = Math.max(minutes, g.originalStart + MIN_DURATION_MINUTES)
      }

      setResize({
        event: g.event,
        edge: g.edge,
        liveStart: g.liveStart,
        liveEnd: g.liveEnd,
      })
    }

    const handleMouseUp = () => {
      const g = gestureRef.current
      if (!g) return
      if (g.active) {
        const startDate = new Date(g.day)
        startDate.setHours(0, g.liveStart, 0, 0)
        const endDate = new Date(g.day)
        endDate.setHours(0, g.liveEnd, 0, 0)
        callbacksRef.current.onEventDrop?.(g.event, startDate, endDate)
        suppressClickRef.current = true
        setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
      }
      gestureRef.current = null
      setResize(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return { resize, beginResize, suppressClickRef }
}
