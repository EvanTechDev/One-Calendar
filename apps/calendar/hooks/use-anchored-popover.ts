'use client'

import { useLayoutEffect, useState } from 'react'
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
  /**
   * Bring a partly or fully off-screen anchor into view once, when the
   * popover opens. For anchors the user did not just click (the create
   * flow's highlighted day in month/year views, a range below the fold)
   * there is no guarantee they are visible — and a popover anchored to the
   * clamped edge of nothing is unmoored.
   */
  scrollIntoViewOnOpen?: boolean
}

export function useLiveAnchorRect({
  open,
  anchorElement,
  anchorSelector,
  anchorRect = null,
  scrollContainerRef,
  scrollIntoViewOnOpen = false,
}: AnchorSource): DOMRect | null {
  const [liveRect, setLiveRect] = useState<DOMRect | null>(null)

  // Layout effect on purpose: resolving the anchor after paint let the
  // popover render one frame at the viewport-centre fallback and then jump
  // to the real anchor — a visible flash on every open whose anchor is
  // resolved via selector (the create flow's blue box).
  useLayoutEffect(() => {
    if (!open) {
      // Closed must mean GONE — a stale liveRect keeps the absolute 1×1
      // anchor div portaled in the scroll container past the content height,
      // stretching every view with blank space at the bottom. But not gone
      // IMMEDIATELY: the popover plays a ~100ms exit animation, and yanking
      // the anchor mid-animation snapped the closing popover to the
      // viewport-centre fallback — it visibly flew before vanishing. Hold
      // the position through the animation, then release.
      const timer = window.setTimeout(() => setLiveRect(null), 250)
      return () => window.clearTimeout(timer)
    }

    // An anchor the user did not click (the create flow's highlighted day)
    // may be scrolled out of view; anchoring to the clamped edge of nothing
    // visible leaves the popover unmoored. Bring it fully on screen first —
    // once, before the anchor is measured.
    if (scrollIntoViewOnOpen) {
      const el =
        anchorElement && anchorElement.isConnected
          ? anchorElement
          : anchorSelector
            ? document.querySelector(anchorSelector)
            : null
      if (el) {
        const r = el.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const fullyVisible =
          r.top >= 0 &&
          r.left >= 0 &&
          r.bottom <= viewportHeight &&
          r.right <= viewportWidth
        if (!fullyVisible) {
          el.scrollIntoView({ block: 'center', behavior: 'instant' })
        }
      }
    }

    // An explicit rect is CLICK-AWARE — the caller built it from where the
    // user actually clicked (e.g. `anchorRectForClick`). It must win over the
    // element's own rect, or the popover snaps back to the block's midpoint;
    // resolving the element first was exactly the bug where day view flipped
    // above/below and week view ignored the click position. The element is
    // still tracked, but only to move the click rect by the same delta when
    // the content scrolls.
    const elementRectAtOpen =
      anchorRect && anchorElement?.isConnected
        ? anchorElement.getBoundingClientRect()
        : null

    const getLiveAnchorRect = (): DOMRect | null => {
      const el =
        anchorElement && anchorElement.isConnected
          ? anchorElement
          : anchorSelector
            ? document.querySelector(anchorSelector)
            : null

      if (anchorRect) {
        if (el && elementRectAtOpen) {
          const now = el.getBoundingClientRect()
          return DOMRect.fromRect({
            x: anchorRect.left + (now.left - elementRectAtOpen.left),
            y: anchorRect.top + (now.top - elementRectAtOpen.top),
            width: anchorRect.width,
            height: anchorRect.height,
          })
        }
        return anchorRect
      }

      if (el) return el.getBoundingClientRect()
      return null
    }

    const update = () => {
      const raw = getLiveAnchorRect()
      // Never anchor off-screen: a long/multi-day block extends past the
      // fold, and its raw rect would place the popover outside the window.
      const next = raw ? clampRectToViewport(raw) : null
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
  }, [
    open,
    anchorElement,
    anchorSelector,
    anchorRect,
    scrollContainerRef,
    scrollIntoViewOnOpen,
  ])

  // First render happens before the effect: clamp the static fallback too.
  return liveRect ?? (anchorRect ? clampRectToViewport(anchorRect) : null)
}

/**
 * The visible part of a rect. A long or multi-day event block extends far
 * past the fold; anchoring to its raw rect puts the popover's attachment
 * point off-screen (the popover renders outside the window) and, converted
 * into scroll-container coordinates, plants the 1×1 anchor div beyond the
 * container's content — which is what stretched every view with blank scroll
 * space at the bottom. Every anchor rect is clamped before use.
 */
export function clampRectToViewport(rect: DOMRect): DOMRect {
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight
  const left = Math.max(rect.left, 0)
  const top = Math.max(rect.top, 0)
  const right = Math.min(rect.right, viewportWidth)
  const bottom = Math.min(rect.bottom, viewportHeight)
  if (
    left === rect.left &&
    top === rect.top &&
    right === rect.right &&
    bottom === rect.bottom
  ) {
    return rect
  }
  return DOMRect.fromRect({
    x: left,
    y: top,
    width: Math.max(right - left, 0),
    height: Math.max(bottom - top, 0),
  })
}

/**
 * When the event block is wider than this fraction of the viewport, no
 * horizontal side can hold the popover from the block's own edges (the
 * remaining space is split too thin). The anchor then collapses to a
 * click-centred strip so the popover opens beside the cursor and overlaps
 * the wide block, instead of flipping above/below and covering the
 * neighbouring rows.
 */
const WIDE_BLOCK_RATIO = 0.5

/** Width of the click-centred anchor strip used for wide blocks. */
const CLICK_ANCHOR_WIDTH = 80

/**
 * The rect the popover anchors to when the user clicked INSIDE an event
 * block: zero-height at the click's Y (clamped onto the block), spanning the
 * block's full width. A side popover then attaches level with the cursor
 * instead of the block's midpoint — which for a tall week-view event could be
 * half a screen away from where the user clicked — while side-picking still
 * judges free space from the block's true horizontal extent.
 *
 * EXCEPT for a block so wide that no side of it could hold the popover (day
 * view, where a block spans most of the grid; month view's multi-day bars).
 * Judging space from those edges forced the popover above/below the block,
 * covering the very rows the user is reading. There the anchor becomes a
 * narrow strip around the click's X, so the popover opens beside the cursor
 * and overlaps the wide block instead.
 */
export function anchorRectForClick(
  blockRect: DOMRect,
  clientX: number,
  clientY: number,
): DOMRect {
  const y = Math.min(Math.max(clientY, blockRect.top), blockRect.bottom)
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth

  // Sidebar-independent: a block wider than half the viewport leaves neither
  // side enough room for the popover, regardless of where the sidebar sits.
  if (blockRect.width > viewportWidth * WIDE_BLOCK_RATIO) {
    const width = Math.min(CLICK_ANCHOR_WIDTH, blockRect.width)
    const x = Math.min(Math.max(clientX, blockRect.left), blockRect.right)
    const left = Math.min(
      Math.max(x - width / 2, blockRect.left),
      blockRect.right - width,
    )
    return DOMRect.fromRect({ x: left, y, width, height: 0 })
  }

  return DOMRect.fromRect({
    x: blockRect.left,
    y,
    width: blockRect.width,
    height: 0,
  })
}

/**
 * Prefer a horizontal side with room for the full estimated size; otherwise
 * the roomier horizontal side, as long as it can hold a meaningful share of
 * the popover; only then flip vertical.
 *
 * The horizontal bias is deliberate. A calendar event block is wide and
 * short, so a vertical popover covers the neighbouring rows the user is
 * looking at — in the day view, where blocks span most of the viewport,
 * neither side fits the FULL width and the old "fits or flip" rule always
 * flipped vertical. Radix's collision handling shifts the popover back into
 * the viewport, so a side with most of the required room still renders fully
 * visible beside the block.
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

  // Neither side fully fits. Take the roomier one if it can hold at least
  // half the popover — collision shifting covers the rest. Below that the
  // popover would sit mostly ON the anchor, which is worse than flipping.
  const bestHorizontal: PopoverSide =
    spaces.right >= spaces.left ? 'right' : 'left'
  if (spaces[bestHorizontal] >= estimatedWidth / 2) return bestHorizontal

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
