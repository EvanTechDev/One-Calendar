'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as lucideIcons from 'lucide-react'
import { Check, Search } from 'lucide-react'
import { RemoveScroll } from 'react-remove-scroll'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@zntr/ui/popover'
import { cn } from '@zntr/utils'
import {
  COUNTDOWN_ICON_GROUPS,
  DEFAULT_COUNTDOWN_ICON,
  searchCountdownIcons,
} from './countdown-icons'

interface CountdownIconPickerProps {
  value: string | undefined
  onChange: (iconName: string) => void
  /** Tailwind bg class of the countdown, used to tint the preview. */
  color: string
  iconColor: string
  placeholder?: string
  triggerLabel?: string
}

function IconGlyph({
  name,
  size,
  color,
}: {
  name: string
  size: number
  color: string
}) {
  const Component =
    (lucideIcons[name as keyof typeof lucideIcons] as
      | React.ComponentType<{ size?: number; style?: React.CSSProperties }>
      | undefined) ?? lucideIcons.Clock
  return <Component size={size} style={{ color }} />
}

/**
 * Icon picker for countdowns.
 *
 * Rewritten because the previous inline version could not be scrolled with the
 * wheel. Two causes, both addressed here:
 *
 * 1. The picker opens inside a Sheet, and Radix's Dialog/Sheet scroll lock
 *    (react-remove-scroll) swallows wheel events for any nested scroller unless
 *    that element is registered as a "shard". The scrolling list is now wrapped
 *    in `RemoveScroll` with itself as a shard — the same fix month-view already
 *    uses for its overflow popover.
 * 2. Radix `ScrollArea` never received the wheel events either, so the list is a
 *    plain native overflow container.
 *
 * The list is also grouped with section headers and keeps the selected icon in
 * view when opened, instead of being one flat 200-item grid.
 */
export default function CountdownIconPicker({
  value,
  onChange,
  iconColor,
  placeholder,
  triggerLabel,
}: CountdownIconPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const selected = value || DEFAULT_COUNTDOWN_ICON

  // Searching flattens the grouping: matches across groups in one grid reads
  // better than a page of empty sections.
  const searchResults = useMemo(
    () => (search.trim() ? searchCountdownIcons(search) : null),
    [search],
  )

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  // Bring the current icon into view so reopening the picker does not always
  // start at the top of the list.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>('[data-selected="true"]')
        ?.scrollIntoView({ block: 'center' })
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const renderCell = (name: string) => {
    const isSelected = name === selected
    return (
      <button
        key={name}
        type="button"
        title={name}
        aria-label={name}
        aria-pressed={isSelected}
        data-selected={isSelected}
        className={cn(
          'relative flex aspect-square w-full items-center justify-center rounded-md transition-colors',
          'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          isSelected && 'bg-accent ring-2 ring-primary',
        )}
        onClick={() => {
          onChange(name)
          setOpen(false)
        }}
      >
        <IconGlyph name={name} size={18} color={iconColor} />
        {isSelected ? (
          <Check className="absolute right-0.5 bottom-0.5 h-2.5 w-2.5 text-primary" />
        ) : null}
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          aria-label={triggerLabel}
        >
          <IconGlyph name={selected} size={18} color={iconColor} />
          <span className="truncate">{selected}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(20rem,calc(100vw-2rem))] p-0"
        align="start"
      >
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="h-8 pl-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/*
          `shards` re-enables wheel/touch scrolling for this element while the
          parent Sheet keeps the page locked. Without it the Sheet's scroll lock
          swallows the wheel and only the scrollbar thumb works.
        */}
        <RemoveScroll enabled={open} shards={[listRef]} removeScrollBar={false}>
          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto overscroll-contain p-2"
          >
            {searchResults ? (
              searchResults.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No icons found
                </p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(2rem,1fr))] gap-1">
                  {searchResults.map(renderCell)}
                </div>
              )
            ) : (
              <div className="space-y-3">
                {COUNTDOWN_ICON_GROUPS.map((group) => (
                  <div key={group.id}>
                    <p className="mb-1 px-0.5 text-xs font-medium text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(2rem,1fr))] gap-1">
                      {group.icons.map(renderCell)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </RemoveScroll>
      </PopoverContent>
    </Popover>
  )
}
