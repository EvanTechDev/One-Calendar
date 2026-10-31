'use client'

import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

export interface ElementSize {
  width: number
  height: number
}

/**
 * The observed box of an element.
 *
 * The video grid picks its columns and page size from the stage's own size
 * rather than the viewport, because opening the chat or people panel takes
 * 320px off the stage without changing the window at all — a media query
 * would keep handing the narrowed stage a desktop layout.
 */
export function useElementSize(
  ref: RefObject<HTMLElement | null>,
): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    // Older Safari and jsdom have no ResizeObserver; a zero size is a valid
    // input that the layout functions treat as "unmeasured".
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((current) =>
        // Sub-pixel jitter from a scrollbar would otherwise re-render the whole
        // grid on every frame.
        Math.abs(current.width - width) < 1 &&
        Math.abs(current.height - height) < 1
          ? current
          : { width, height },
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}
