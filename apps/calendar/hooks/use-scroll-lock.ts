'use client'
import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Freezes a scroll container while an overlay is open.
 *
 * `<RemoveScroll>` is not a substitute, and cannot be: it only cancels `wheel`
 * and `touch*` at the document level, so the container stays scrollable by
 * keyboard (Space / PageDown / Home / End), by dragging its own scrollbar, and
 * by focus pulling an off-screen control into view. The calendar's grid lives in
 * an `overflow-auto` div rather than the body, which is why the popover over
 * the year view could be opened and then scrolled out from under itself.
 *
 * Pair it with `RemoveScroll` rather than replacing it — that is still what
 * stops the overscroll chaining and keeps `preventDefault` from killing
 * scrolling inside the overlay's own list (pass the list as a `shard`).
 *
 * `scrollbar-gutter: stable` holds the scrollbar's width open while `overflow`
 * takes it away, so locking does not nudge the page sideways.
 */
export function useScrollLock(
  containerRef: RefObject<HTMLElement | null> | undefined,
  active: boolean,
) {
  useEffect(() => {
    const container = containerRef?.current
    if (!active || !container) return

    const previousOverflow = container.style.overflow
    const previousGutter = container.style.scrollbarGutter
    container.style.overflow = 'hidden'
    container.style.scrollbarGutter = 'stable'

    return () => {
      container.style.overflow = previousOverflow
      container.style.scrollbarGutter = previousGutter
    }
  }, [containerRef, active])
}
