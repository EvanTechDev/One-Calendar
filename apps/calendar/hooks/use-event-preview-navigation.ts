'use client'

import { useEffect, type RefObject } from 'react'
import { format } from 'date-fns'
import { isMobileViewport } from '@/lib/mobile-viewport'

/** Wait for the destination view AND its overflow portal before anchoring. */
export function useEventPreviewNavigation(
  target: { id: string; startDate: Date } | null,
  containerRef: RefObject<HTMLElement | null>,
  onReady: (anchor: HTMLElement | null) => void,
) {
  useEffect(() => {
    if (!target) return
    // Mobile previews are full-screen and do not need an underlying anchor.
    if (isMobileViewport()) {
      onReady(null)
      return
    }
    let frame = 0
    let finished = false
    let revealed: HTMLElement | null = null
    const observer = new MutationObserver(locate)
    let timeout = window.setTimeout(() => finish(null), 1500)

    function finish(anchor: HTMLElement | null) {
      if (finished) return
      finished = true
      observer.disconnect()
      window.clearTimeout(timeout)
      onReady(anchor)
    }

    function locate() {
      if (finished || frame) return
      const anchor = Array.from(
        document.querySelectorAll<HTMLElement>('[data-event-id]'),
      ).find((element) => element.dataset.eventId === target!.id)
      if (anchor) {
        // Once found, allow the positioning frame to finish even on a busy
        // year grid. The missing-event timeout must not race that frame.
        window.clearTimeout(timeout)
        anchor.scrollIntoView({ block: 'nearest', behavior: 'instant' })
        // Radix positions the portal after mounting it. Measure on the next
        // frame, rather than capturing its initial off-screen rectangle.
        frame = requestAnimationFrame(() => {
          frame = 0
          if (anchor.isConnected) finish(anchor)
          else {
            timeout = window.setTimeout(() => finish(null), 1500)
            locate()
          }
        })
        return
      }
      const day = format(target!.startDate, 'yyyy-MM-dd')
      const trigger = containerRef.current?.querySelector<HTMLElement>(
        `[data-event-reveal-date="${day}"]`,
      )
      if (trigger && trigger !== revealed) {
        revealed = trigger
        trigger.scrollIntoView({ block: 'nearest', behavior: 'instant' })
        trigger.click()
      }
    }

    observer.observe(document.body, { childList: true, subtree: true })
    locate()
    return () => {
      finished = true
      observer.disconnect()
      window.clearTimeout(timeout)
      cancelAnimationFrame(frame)
    }
  }, [target, containerRef, onReady])
}
