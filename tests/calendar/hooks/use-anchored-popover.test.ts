// @vitest-environment jsdom
/**
 * Positioning rules for the anchored popovers (event preview + editor).
 *
 * Two reported bugs drive these tests, and they share one root cause:
 * `useLiveAnchorRect` resolved the anchor element FIRST and only fell back to
 * the provided rect, so the click-aware rects the calendar builds (day view:
 * the click point; week view: block X extent + click Y) were discarded on the
 * very first update and replaced with the block's own rect. Day view then saw
 * a near-full-width anchor — neither side fit — and flipped above/below; week
 * view attached at the block's vertical middle regardless of the click.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  pickPopoverSide,
  buildAnchorStyle,
  anchorRectForClick,
  clampRectToViewport,
  useLiveAnchorRect,
} from '@/hooks/use-anchored-popover'

const WIDTH = 460
const HEIGHT = 520

function rect(x: number, y: number, w: number, h: number): DOMRect {
  return DOMRect.fromRect({ x, y, width: w, height: h })
}

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true })
  Object.defineProperty(window, 'innerHeight', {
    value: h,
    configurable: true,
  })
}

describe('pickPopoverSide', () => {
  it('prefers a horizontal side that fully fits', () => {
    setViewport(1440, 900)
    expect(pickPopoverSide(rect(100, 300, 150, 40), WIDTH, HEIGHT)).toBe(
      'right',
    )
  })

  it('takes the roomier horizontal side when it holds at least half the popover', () => {
    // Tablet-landscape day view: the block leaves 300px to the right — not
    // the full 460, but collision shifting covers the rest. The old
    // fits-or-flip rule sent this vertical, covering the rows the user is
    // reading.
    setViewport(1200, 800)
    expect(pickPopoverSide(rect(0, 200, 900, 40), WIDTH, HEIGHT)).toBe('right')
  })

  it('flips vertical when neither side can hold half the popover', () => {
    // Phone-sized viewport: 10px left, 30px right. Horizontal placement
    // would sit almost entirely on the anchor; below is the only sane side.
    setViewport(390, 844)
    expect(pickPopoverSide(rect(10, 100, 350, 40), WIDTH, HEIGHT)).toBe(
      'bottom',
    )
  })

  it('falls back to bottom with no rect', () => {
    expect(pickPopoverSide(null, WIDTH, HEIGHT)).toBe('bottom')
  })
})

describe('anchorRectForClick', () => {
  // THE WEEK-VIEW CONTRACT: the anchor follows the click's Y, spans the
  // block's width (so side space is judged from the block's real edges), and
  // never leaves the block.
  const block = rect(300, 200, 180, 600)

  it('pins the vertical position to the click', () => {
    setViewport(1440, 900)
    const anchored = anchorRectForClick(block, 350, 750)
    expect(anchored.top).toBe(750)
    expect(anchored.height).toBe(0)
  })

  it('keeps the block horizontal extent so side space is judged correctly', () => {
    setViewport(1440, 900)
    const anchored = anchorRectForClick(block, 350, 750)
    expect(anchored.left).toBe(300)
    expect(anchored.width).toBe(180)
  })

  it('clamps a click outside the block back onto it', () => {
    setViewport(1440, 900)
    expect(anchorRectForClick(block, 350, 150).top).toBe(200)
    expect(anchorRectForClick(block, 350, 900).top).toBe(800)
  })

  // THE DAY-VIEW CONTRACT: a block wider than half the viewport (day view
  // spans most of the grid) must NOT judge sides from its own edges — that
  // forced the popover above/below the block. The anchor collapses to a
  // narrow strip around the click's X, so the popover opens beside the
  // cursor and overlaps the wide block instead.
  describe('wide blocks (day view)', () => {
    // 1300px block in a 1440px viewport → 90% > 50% → narrow anchor.
    const wideBlock = rect(64, 200, 1300, 48)

    it('collapses the anchor to a strip around the click', () => {
      setViewport(1440, 900)
      const anchored = anchorRectForClick(wideBlock, 700, 220)
      expect(anchored.width).toBe(80)
      expect(anchored.left).toBe(660) // centred on the click X
      expect(anchored.top).toBe(220)
    })

    it('keeps the strip inside the block for clicks near its edges', () => {
      setViewport(1440, 900)
      const nearLeft = anchorRectForClick(wideBlock, 70, 220)
      expect(nearLeft.left).toBe(64)
      const nearRight = anchorRectForClick(wideBlock, 1360, 220)
      expect(nearRight.left + nearRight.width).toBeCloseTo(1364)
    })

    it('lets pickPopoverSide choose a horizontal side from the strip', () => {
      setViewport(1440, 900)
      const anchored = anchorRectForClick(wideBlock, 700, 220)
      expect(pickPopoverSide(anchored, WIDTH, HEIGHT)).toBe('right')
    })

    it('triggers even when the sidebar makes blockRect.left large', () => {
      // Sidebar expanded: block starts at x=364 but is still 900px wide
      // (62.5% of a 1440px viewport) — the old sideRoom check missed this
      // because blockRect.left (364) exceeded the threshold.
      setViewport(1440, 900)
      const blockWithSidebar = rect(364, 200, 900, 48)
      const anchored = anchorRectForClick(blockWithSidebar, 800, 220)
      expect(anchored.width).toBe(80)
      expect(pickPopoverSide(anchored, WIDTH, HEIGHT)).not.toBe('top')
      expect(pickPopoverSide(anchored, WIDTH, HEIGHT)).not.toBe('bottom')
    })

    it('still uses the block extent when the block is narrow (week view)', () => {
      setViewport(1440, 900)
      const anchored = anchorRectForClick(rect(300, 200, 180, 600), 350, 750)
      expect(anchored.left).toBe(300)
      expect(anchored.width).toBe(180)
    })
  })
})

describe('useLiveAnchorRect', () => {
  function mountAnchor(elRect: DOMRect) {
    const el = document.createElement('div')
    el.setAttribute('data-event-id', 'evt-1')
    let current = elRect
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => current,
      configurable: true,
    })
    document.body.appendChild(el)
    return {
      el,
      moveTo(next: DOMRect) {
        current = next
      },
    }
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('honours a click-built rect instead of replacing it with the element rect', () => {
    // THE ROOT CAUSE of both reported bugs. The calendar hands the hook a
    // click-aware rect; resolving the element first threw it away.
    const { el } = mountAnchor(rect(100, 200, 800, 40))
    const clickRect = rect(100, 225, 800, 0) // click Y inside the block

    const { result } = renderHook(() =>
      useLiveAnchorRect({
        open: true,
        anchorElement: el,
        anchorRect: clickRect,
        scrollContainerRef: undefined,
      }),
    )

    expect(result.current?.top).toBe(225)
    expect(result.current?.height).toBe(0)
  })

  it('moves the click rect with the element when the page scrolls', () => {
    // Live tracking must survive: on scroll the anchor shifts by the same
    // delta as the element, keeping the popover glued to the block.
    const { el, moveTo } = mountAnchor(rect(100, 200, 800, 40))
    const clickRect = rect(100, 225, 800, 0)

    const { result } = renderHook(() =>
      useLiveAnchorRect({
        open: true,
        anchorElement: el,
        anchorRect: clickRect,
        scrollContainerRef: undefined,
      }),
    )

    act(() => {
      moveTo(rect(100, 140, 800, 40)) // scrolled 60px up
      window.dispatchEvent(new Event('scroll'))
    })

    expect(result.current?.top).toBe(165) // 225 - 60
  })

  it('uses the element rect when no explicit rect is given', () => {
    const { el } = mountAnchor(rect(100, 200, 800, 40))
    const { result } = renderHook(() =>
      useLiveAnchorRect({
        open: true,
        anchorElement: el,
        anchorRect: null,
        scrollContainerRef: undefined,
      }),
    )
    expect(result.current?.top).toBe(200)
    expect(result.current?.height).toBe(40)
  })

  it('holds the anchor through the exit animation, then releases it', () => {
    // Two constraints pull against each other here.
    // Release too late (never): the absolute 1x1 anchor stays portaled in
    // the shared scroll container past the content height — the
    // bottom-whitespace bug. Release too early (immediately): the popover's
    // 100ms exit animation is still running when the anchor snaps to the
    // viewport-centre fallback, so the closing popover visibly FLIES to the
    // centre before vanishing. The anchor must outlive the animation, then
    // go away.
    vi.useFakeTimers()
    try {
      const { el } = mountAnchor(rect(100, 200, 800, 40))
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useLiveAnchorRect({
            open,
            anchorElement: el,
            anchorRect: null,
            scrollContainerRef: undefined,
          }),
        { initialProps: { open: true } },
      )
      expect(result.current).not.toBeNull()

      rerender({ open: false })
      // Exit animation window: position must hold.
      expect(result.current).not.toBeNull()
      expect(result.current?.top).toBe(200)

      act(() => {
        vi.advanceTimersByTime(300)
      })
      // Animation over: anchor released, no stale div in the container.
      expect(result.current).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to the static rect when the element is gone', () => {
    const clickRect = rect(300, 400, 0, 0)
    const { result } = renderHook(() =>
      useLiveAnchorRect({
        open: true,
        anchorElement: null,
        anchorRect: clickRect,
        scrollContainerRef: undefined,
      }),
    )
    expect(result.current?.top).toBe(400)
    expect(result.current?.left).toBe(300)
  })
})

describe('scrollIntoViewOnOpen', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('scrolls an off-screen anchor element into view before measuring', () => {
    // Month/year views: the highlighted create-target day can be outside the
    // scrolled viewport, so the popover anchored to a clamped edge of
    // nothing visible. The hook must bring the anchor on screen first.
    setViewport(1024, 768)
    const el = document.createElement('div')
    let r = rect(300, 2000, 40, 40) // far below the fold
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => r,
      configurable: true,
    })
    const scrolled: unknown[] = []
    Object.defineProperty(el, 'scrollIntoView', {
      value: (opts: unknown) => {
        scrolled.push(opts)
        r = rect(300, 364, 40, 40) // browser brings it to centre
      },
    })
    document.body.appendChild(el)

    const { result } = renderHook(() =>
      useLiveAnchorRect({
        open: true,
        anchorElement: el,
        anchorRect: null,
        scrollContainerRef: undefined,
        scrollIntoViewOnOpen: true,
      }),
    )

    expect(scrolled).toHaveLength(1)
    // The measured rect is the post-scroll, on-screen one.
    expect(result.current?.top).toBe(364)
  })

  it('does not scroll when the anchor is already fully visible', () => {
    setViewport(1024, 768)
    const el = document.createElement('div')
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => rect(300, 300, 40, 40),
    })
    const scrolled: unknown[] = []
    Object.defineProperty(el, 'scrollIntoView', {
      value: (opts: unknown) => scrolled.push(opts),
    })
    document.body.appendChild(el)

    renderHook(() =>
      useLiveAnchorRect({
        open: true,
        anchorElement: el,
        anchorRect: null,
        scrollContainerRef: undefined,
        scrollIntoViewOnOpen: true,
      }),
    )
    expect(scrolled).toHaveLength(0)
  })
})

describe('buildAnchorStyle', () => {
  it('places a right-side anchor on the right edge at the rect vertical centre', () => {
    // A zero-height click rect: its "centre" IS the click Y, so the popover
    // attaches level with the cursor.
    const container = document.createElement('div')
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => rect(0, 0, 1024, 768),
    })
    Object.defineProperty(container, 'scrollLeft', { value: 0 })
    Object.defineProperty(container, 'scrollTop', { value: 100 })

    const style = buildAnchorStyle(rect(300, 450, 180, 0), 'right', container)
    expect(style.left).toBe(480)
    expect(style.top).toBe(550)
  })

  it('centres in the viewport with no rect', () => {
    setViewport(1000, 600)
    const style = buildAnchorStyle(null, 'bottom', null)
    expect(style.position).toBe('fixed')
    expect(style.left).toBe(500)
    expect(style.top).toBe(300)
  })
})

describe('viewport clamping', () => {
  // THE REPORTED PAIR: a multi-day/long event block extends past the
  // viewport bottom. Unclamped, the anchor's edge point lands off-screen —
  // the popover renders outside the window, and converting that point into
  // scroll-container coordinates plants an absolute 1x1 anchor BEYOND the
  // container's content, stretching every view with blank scroll space.
  it('clamps a rect taller than the viewport', () => {
    setViewport(1024, 768)
    const clamped = clampRectToViewport(rect(300, 100, 180, 1400))
    expect(clamped.top).toBe(100)
    expect(clamped.bottom).toBe(768)
    expect(clamped.left).toBe(300)
  })

  it('clamps a rect extending past the right edge', () => {
    setViewport(1024, 768)
    const clamped = clampRectToViewport(rect(800, 100, 600, 40))
    expect(clamped.left).toBe(800)
    expect(clamped.right).toBe(1024)
  })

  it('returns on-screen rects unchanged', () => {
    setViewport(1024, 768)
    const r = rect(100, 100, 200, 40)
    const clamped = clampRectToViewport(r)
    expect(clamped.top).toBe(100)
    expect(clamped.bottom).toBe(140)
    expect(clamped.left).toBe(100)
    expect(clamped.right).toBe(300)
  })

  it('useLiveAnchorRect never returns a rect edge outside the viewport', () => {
    setViewport(1024, 768)
    const el = document.createElement('div')
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => rect(300, 100, 180, 1400), // long event, below the fold
    })
    document.body.appendChild(el)

    const { result } = renderHook(() =>
      useLiveAnchorRect({
        open: true,
        anchorElement: el,
        anchorRect: null,
        scrollContainerRef: undefined,
      }),
    )
    expect(result.current!.bottom).toBeLessThanOrEqual(768)
    document.body.innerHTML = ''
  })
})
