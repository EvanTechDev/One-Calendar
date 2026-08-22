'use client'

import { useEffect, useState } from 'react'
import type React from 'react'

/**
 * Anchor plumbing shared by the event preview and the event editor popovers,
 * so the two position identically (CORE-191).
 *
 * The anchor is resolved live — from a connected element, a DOM query, or a
 * static rect — and re-measured on scroll and resize, because calendar cells
 * move under the popover while it is open. The popover then opens toward
 * whichever side has room, and the Radix anchor is a 1×1 point placed on the
 * chosen edge of the rect (inside the scroll container when one is given, so
 * the anchor scrolls with the content).
 */

export type PopoverSide = 'top' | 'right' | 'bottom' | 'left'

export interface AnchorSource {
  open: boolean
  /** Preferred anchor when still connected to the document. */
  anchorElement?: HTMLElement | null
  /** CSS selector fallback, e.g. `[data-event-id="…"]`. Queried each update. */
  anchorSelector?: string | null
  /** Static fallback when no element can be found. */
  anchorRect?: DOMRect | null
  /** Scrollable ancestor whose scrolling should re-anchor the popover. */
  scrollContainerRef?: React.RefObject<HTMLElement | null>
}

export function useLiveAnchorRect({
  open,
  anchorElement,
  anchorSelector,
  anchorRect = null,
  scrollContainerRef,
}: AnchorSource): DOMRect | null {
  const [liveRect, setLiveRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!open) return

    const getLiveAnchorRect = (): DOMRect | null => {
      const el =
        anchorElement && anchorElement.isConnected
          ? anchorElement
          : anchorSelector
            ? document.querySelector(anchorSelector)
            : null
      if (el) return el.getBoundingClientRect()
      return anchorRect
    }

    const update = () => {
      const next = getLiveAnchorRect()
      setLiveRect((prev) => {
        if (
          prev &&
          next &&
          prev.left === next.left &&
          prev.top === next.top &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev
        }
        return next
      })
    }
    update()

    const container = scrollContainerRef?.current
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    container?.addEventListener('scroll', update, true)

    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      container?.removeEventListener('scroll', update, true)
    }
  }, [open, anchorElement, anchorSelector, anchorRect, scrollContainerRef])

  return liveRect ?? anchorRect ?? null
}

/**
 * Prefer a horizontal side with room for the full estimated size; otherwise a
 * vertical one; otherwise whichever direction has the most space. Estimated
 * rather than measured because the popover has not rendered yet.
 */
export function pickPopoverSide(
  rect: DOMRect | null,
  estimatedWidth: number,
  estimatedHeight: number,
): PopoverSide {
  if (!rect) return 'bottom'
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight
  const spaces = {
    top: rect.top,
    right: viewportWidth - rect.right,
    bottom: viewportHeight - rect.bottom,
    left: rect.left,
  }
  if (spaces.right >= estimatedWidth) return 'right'
  if (spaces.left >= estimatedWidth) return 'left'
  if (spaces.bottom >= estimatedHeight) return 'bottom'
  if (spaces.top >= estimatedHeight) return 'top'
  const entries = Object.entries(spaces) as Array<[PopoverSide, number]>
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

/**
 * A 1×1 anchor point on the rect's `side` edge. Positioned inside the scroll
 * container (in content coordinates) when one is given, so it scrolls with
 * the calendar; otherwise fixed at the viewport centre as a last resort.
 */
export function buildAnchorStyle(
  rect: DOMRect | null,
  side: PopoverSide,
  scrollContainer: HTMLElement | null | undefined,
): React.CSSProperties {
  if (rect && scrollContainer) {
    const containerRect = scrollContainer.getBoundingClientRect()
    const midX = rect.left + rect.width / 2
    const midY = rect.top + rect.height / 2
    const edgePoint =
      side === 'right'
        ? { left: rect.right, top: midY }
        : side === 'left'
          ? { left: rect.left, top: midY }
          : side === 'top'
            ? { left: midX, top: rect.top }
            : { left: midX, top: rect.bottom }
    return {
      position: 'absolute',
      left: edgePoint.left - containerRect.left + scrollContainer.scrollLeft,
      top: edgePoint.top - containerRect.top + scrollContainer.scrollTop,
      width: 1,
      height: 1,
      pointerEvents: 'none',
    }
  }

  return {
    position: 'fixed',
    left: typeof window === 'undefined' ? 0 : Math.round(window.innerWidth / 2),
    top: typeof window === 'undefined' ? 0 : Math.round(window.innerHeight / 2),
    width: 1,
    height: 1,
    pointerEvents: 'none',
  }
}
