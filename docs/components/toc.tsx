'use client'

// The supplied template used Fumadocs UI 16.8.1's straight-line TOC.
// Adapted from its components/toc/default.js; see toc.LICENSE.
import * as Primitive from 'fumadocs-core/toc'
import { useTOCItems } from 'fumadocs-ui/components/toc'
import {
  type ComponentProps,
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/cn'
import { mergeRefs } from '@/lib/merge-refs'

type Computed = { positions: [number, number][] }

export function TOCItems({ ref, className, ...props }: ComponentProps<'div'>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const items = useTOCItems()
  const [computed, setComputed] = useState<Computed | null>(null)
  const onCompute = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    if (items.length === 0) {
      setComputed(null)
      return
    }
    const positions: Computed['positions'] = []
    for (const item of items) {
      const element = container.querySelector<HTMLAnchorElement>(
        `a[href="${item.url}"]`,
      )
      if (!element) return
      const styles = getComputedStyle(element)
      positions.push([
        element.offsetTop + parseFloat(styles.paddingTop),
        element.offsetTop +
          element.clientHeight -
          parseFloat(styles.paddingBottom),
      ])
    }
    setComputed({ positions })
  }, [items])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(onCompute)
    observer.observe(container)
    onCompute()
    return () => observer.disconnect()
  }, [onCompute])

  return (
    <div className="relative">
      {computed && <TocThumb computed={computed} />}
      <div
        ref={mergeRefs(ref, containerRef)}
        className={cn(
          'flex flex-col border-s border-fd-foreground/10',
          className,
        )}
        {...props}
      />
    </div>
  )
}

function TocThumb({ computed }: { computed: Computed }) {
  const ref = useRef<HTMLDivElement>(null)
  const tocInfo = Primitive.useTOC()
  function calculate(items: Primitive.TOCItemInfo[]): Record<string, string> {
    const startIdx = items.findIndex((item) => item.active)
    const endIdx = items.findLastIndex((item) => item.active)
    const start = computed.positions[startIdx]
    const end = computed.positions[endIdx]
    if (!start || !end) return {}
    return {
      '--track-top': `${start[0]}px`,
      '--track-bottom': `${end[1]}px`,
    }
  }
  Primitive.useTOCListener((items) => {
    const element = ref.current
    if (!element) return
    for (const [key, value] of Object.entries(calculate(items))) {
      element.style.setProperty(key, value)
    }
  })

  return (
    <div
      ref={ref}
      className="absolute inset-y-0 inset-s-0 bg-fd-primary w-px transition-[clip-path]"
      style={
        {
          clipPath:
            'polygon(0 var(--track-top,0), 100% var(--track-top,0), 100% var(--track-bottom,0), 0 var(--track-bottom,0))',
          ...calculate(tocInfo.get()),
        } as CSSProperties
      }
    />
  )
}

export function TOCEmpty() {
  return (
    <div className="rounded-lg border bg-fd-card p-3 text-xs text-fd-muted-foreground">
      No Headings
    </div>
  )
}

export function TOCItem({
  item,
  ...props
}: ComponentProps<'a'> & { item: Primitive.TOCItemType }) {
  return (
    <Primitive.TOCItem
      href={item.url}
      {...props}
      className={cn(
        'prose py-1.5 text-sm text-fd-muted-foreground scroll-m-4 transition-colors wrap-anywhere first:pt-0 last:pb-0 data-[active=true]:text-fd-primary hover:text-fd-accent-foreground',
        item.depth <= 2 && 'ps-3',
        item.depth === 3 && 'ps-6',
        item.depth >= 4 && 'ps-8',
        props.className,
      )}
    >
      {item.title}
    </Primitive.TOCItem>
  )
}
