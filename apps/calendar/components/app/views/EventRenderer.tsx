'use client'

import type React from 'react'
import { Edit3, Share2, Bookmark, Trash2 } from 'lucide-react'
import { cn } from '@zntr/utils'
import type { CalendarEvent } from '@/components/app/calendar'
import type { ViewConfig } from '@/components/app/calendar-types'
import { EventLayoutEngine as EventLayoutEngineClass } from '@/components/app/views/engine/EventLayoutEngine'
import { translations } from '@zntr/i18n/calendar'
import {
  getEventAccentColor,
  getEventBackgroundColor,
} from '@/components/app/views/event-colors'
import { formatSelectionRange } from '@/components/app/views/selection-range'

const ContextMenu = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)
const ContextMenuTrigger = ({
  children,
}: {
  children: React.ReactNode
  asChild?: boolean
}) => <>{children}</>
const ContextMenuContent = ({
  children,
  _className,
}: {
  children: React.ReactNode
  className?: string
  _className?: string
}) => <>{children}</>
const ContextMenuItem = (_props: {
  children?: React.ReactNode
  className?: string
  onSelect?: (event: React.SyntheticEvent) => void
}) => null

interface EventRendererProps {
  event: CalendarEvent
  layout: {
    start: Date
    end: Date
    column: number
    totalColumns: number
    isMultiDay: boolean
  }
  config: ViewConfig
  isDark: boolean
  onEventClick: (event: CalendarEvent, anchorEl?: HTMLElement | null) => void
  onEditEvent?: (event: CalendarEvent) => void
  onDeleteEvent?: (event: CalendarEvent) => void
  onShareEvent?: (event: CalendarEvent) => void
  onBookmarkEvent?: (event: CalendarEvent) => void
  onEventDragStart?: (event: CalendarEvent, e: React.MouseEvent) => void
  onEventDragEnd?: () => void
  isDragging?: boolean
  ignoreNextEventClickRef?: React.MutableRefObject<boolean>
  isDraggingRef?: React.MutableRefObject<boolean>
  queueIgnoreEventClick?: () => void
  showTime?: boolean
  className?: string
}

function formatDateWithTimezone(
  date: Date,
  language: ViewConfig['language'],
  timeFormat: ViewConfig['timeFormat'],
  timezone: string,
): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat.is12Hour(),
    timeZone: timezone,
  }
  return new Intl.DateTimeFormat(language.code, options).format(date)
}

export function EventRenderer({
  event,
  layout,
  config,
  isDark,
  onEventClick,
  onEditEvent,
  onDeleteEvent,
  onShareEvent,
  onBookmarkEvent,
  onEventDragStart,
  onEventDragEnd,
  isDragging: _isDragging,
  ignoreNextEventClickRef,
  isDraggingRef,
  queueIgnoreEventClick,
  showTime = true,
  className: _className,
}: EventRendererProps) {
  if (!config) return null
  const layoutEngine = EventLayoutEngineClass.create(config)
  const t = translations[config.language.code as keyof typeof translations]

  const menuLabels = {
    edit: t.edit,
    share: t.share,
    bookmark: t.bookmark,
    delete: t.delete,
  }

  const startMinutes = layout.start.getHours() * 60 + layout.start.getMinutes()
  const endMinutes = layout.end.getHours() * 60 + layout.end.getMinutes()
  const duration = endMinutes - startMinutes

  const minHeight = 20
  const height = Math.max(duration, minHeight)

  const width = `calc((100% - 8px) / ${layout.totalColumns})`
  const left = `calc(${layout.column} * ${width})`

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (ignoreNextEventClickRef?.current) return
    if (!isDraggingRef?.current) {
      onEventClick(event, e.currentTarget as HTMLElement)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    onEventDragStart?.(event, e)
  }

  const handleMouseUp = () => {
    onEventDragEnd?.()
  }

  const handleMouseLeave = () => {
    onEventDragEnd?.()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    queueIgnoreEventClick?.()
  }

  return (
    <ContextMenu key={event.id}>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'relative absolute rounded-lg p-2 text-sm cursor-pointer overflow-hidden',
            event.color,
            _className,
          )}
          style={{
            top: `${startMinutes}px`,
            height: `${height}px`,
            opacity: isDark ? 1 : 0.9,
            backgroundColor: getEventBackgroundColor(event.color, isDark),
            width,
            left,
            zIndex: layout.column + 1,
          }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
          onClick={handleClick}
        >
          <div
            className={cn('absolute left-0 top-0 w-1 h-full rounded-l-md')}
            style={{ backgroundColor: getEventAccentColor(event.color) }}
          />
          <div className="pl-1">
            <div
              className="font-medium leading-tight break-words"
              style={{
                color: getEventAccentColor(event.color),
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: Math.max(1, Math.floor((height - 8) / 16)),
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {event.title}
            </div>
            {showTime && height >= 40 && (
              <div
                className="text-xs truncate"
                style={{ color: getEventAccentColor(event.color) }}
              >
                {layout.isMultiDay ? (
                  <>
                    {formatDateWithTimezone(
                      layout.start,
                      config.language,
                      config.timeFormat,
                      config.timezone,
                    )}{' '}
                    -{' '}
                    {formatDateWithTimezone(
                      layout.end,
                      config.language,
                      config.timeFormat,
                      config.timezone,
                    )}
                  </>
                ) : (
                  <>
                    {layoutEngine.formatHourMinute(
                      layout.start.getHours(),
                      layout.start.getMinutes(),
                    )}{' '}
                    -{' '}
                    {layoutEngine.formatHourMinute(
                      layout.end.getHours(),
                      layout.end.getMinutes(),
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-40">
        <ContextMenuItem
          onSelect={(e) => {
            e.preventDefault()
            e.stopPropagation()
            queueIgnoreEventClick?.()
            onEditEvent?.(event)
          }}
        >
          <Edit3 className="mr-2 h-4 w-4" />
          {menuLabels.edit}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={(e) => {
            e.preventDefault()
            e.stopPropagation()
            queueIgnoreEventClick?.()
            onShareEvent?.(event)
          }}
        >
          <Share2 className="mr-2 h-4 w-4" />
          {menuLabels.share}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={(e) => {
            e.preventDefault()
            e.stopPropagation()
            queueIgnoreEventClick?.()
            onBookmarkEvent?.(event)
          }}
        >
          <Bookmark className="mr-2 h-4 w-4" />
          {menuLabels.bookmark}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={(e) => {
            e.preventDefault()
            e.stopPropagation()
            queueIgnoreEventClick?.()
            onDeleteEvent?.(event)
          }}
          className="text-red-600"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {menuLabels.delete}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

interface AllDayEventRendererProps {
  event: CalendarEvent
  index: number
  config: ViewConfig
  isDark: boolean
  onEventClick: (event: CalendarEvent, anchorEl?: HTMLElement | null) => void
  onEditEvent?: (event: CalendarEvent) => void
  onDeleteEvent?: (event: CalendarEvent) => void
  onShareEvent?: (event: CalendarEvent) => void
  onBookmarkEvent?: (event: CalendarEvent) => void
  onEventDragStart?: (event: CalendarEvent, e: React.MouseEvent) => void
  onEventDragEnd?: () => void
  isDragging?: boolean
  ignoreNextEventClickRef?: React.MutableRefObject<boolean>
  isDraggingRef?: React.MutableRefObject<boolean>
  queueIgnoreEventClick?: () => void
  eventSpacing?: number
  className?: string
}

export function AllDayEventRenderer({
  event,
  index,
  config,
  isDark,
  onEventClick,
  onEditEvent,
  onDeleteEvent,
  onShareEvent,
  onBookmarkEvent,
  onEventDragStart,
  onEventDragEnd,
  isDragging: _isDragging,
  ignoreNextEventClickRef,
  isDraggingRef,
  queueIgnoreEventClick,
  eventSpacing = 3,
  className,
}: AllDayEventRendererProps) {
  if (!config) return null
  const t = translations[config.language.code as keyof typeof translations]

  const menuLabels = {
    edit: t.edit,
    share: t.share,
    bookmark: t.bookmark,
    delete: t.delete,
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (ignoreNextEventClickRef?.current) return
    if (!isDraggingRef?.current) {
      onEventClick(event, e.currentTarget as HTMLElement)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    onEventDragStart?.(event, e)
  }

  const handleMouseUp = () => {
    onEventDragEnd?.()
  }

  const handleMouseLeave = () => {
    onEventDragEnd?.()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    queueIgnoreEventClick?.()
  }

  return (
    <ContextMenu key={`allday-${event.id}`}>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'relative rounded-lg p-1 text-xs cursor-pointer overflow-hidden',
            event.color,
            className,
          )}
          style={{
            height: '20px',
            top: index * (20 + eventSpacing) + 'px',
            position: 'absolute',
            left: '0',
            right: '0',
            opacity: isDark ? 1 : 0.9,
            backgroundColor: getEventBackgroundColor(event.color, isDark),
            zIndex: 10 + index,
          }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
          onClick={handleClick}
        >
          <div
            className={cn('absolute left-0 top-0 w-1 h-full rounded-l-md')}
            style={{ backgroundColor: getEventAccentColor(event.color) }}
          />
          <div
            className="pl-1.5 truncate"
            style={{ color: getEventAccentColor(event.color) }}
          >
            {event.title}
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-40">
        <ContextMenuItem
          onSelect={(e) => {
            e.preventDefault()
            e.stopPropagation()
            queueIgnoreEventClick?.()
            onEditEvent?.(event)
          }}
        >
          <Edit3 className="mr-2 h-4 w-4" />
          {menuLabels.edit}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={(e) => {
            e.preventDefault()
            e.stopPropagation()
            queueIgnoreEventClick?.()
            onShareEvent?.(event)
          }}
        >
          <Share2 className="mr-2 h-4 w-4" />
          {menuLabels.share}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={(e) => {
            e.preventDefault()
            e.stopPropagation()
            queueIgnoreEventClick?.()
            onBookmarkEvent?.(event)
          }}
        >
          <Bookmark className="mr-2 h-4 w-4" />
          {menuLabels.bookmark}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={(e) => {
            e.preventDefault()
            e.stopPropagation()
            queueIgnoreEventClick?.()
            onDeleteEvent?.(event)
          }}
          className="text-red-600"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {menuLabels.delete}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

interface DragPreviewRendererProps {
  draggingEvent: CalendarEvent | null
  dragPreview: { hour: number; minute: number } | null
  dragEventDuration: number
  config: ViewConfig
  isDark: boolean
  layoutEngine?: InstanceType<typeof EventLayoutEngineClass>
}

export function DragPreviewRenderer({
  draggingEvent,
  dragPreview,
  dragEventDuration,
  config,
  isDark,
  layoutEngine: providedLayoutEngine,
}: DragPreviewRendererProps) {
  if (!dragPreview || !draggingEvent || !config) return null

  const layoutEngine =
    providedLayoutEngine ?? EventLayoutEngineClass.create(config)

  const startMinutes = dragPreview.hour * 60 + dragPreview.minute
  const endMinutes = startMinutes + dragEventDuration

  return (
    <div
      className={cn(
        'absolute rounded-lg p-2 text-sm overflow-hidden',
        draggingEvent.color,
      )}
      style={{
        top: `${startMinutes}px`,
        height: `${dragEventDuration}px`,
        opacity: 0.6,
        width: `calc(100% - 4px)`,
        left: '2px',
        zIndex: 100,
        border: '2px dashed white',
        backgroundColor: getEventBackgroundColor(draggingEvent?.color, isDark),
        pointerEvents: 'none',
      }}
    >
      <div
        className={cn('absolute left-0 top-0 w-1 h-full rounded-l-md')}
        style={{ backgroundColor: getEventAccentColor(draggingEvent.color) }}
      />
      <div className="pl-1">
        <div
          className="font-medium truncate"
          style={{ color: getEventAccentColor(draggingEvent.color) }}
        >
          {draggingEvent.title}
        </div>
        {dragEventDuration >= 40 && (
          <div className="text-xs text-white/90 truncate">
            {layoutEngine.formatHourMinute(
              dragPreview.hour,
              dragPreview.minute,
            )}{' '}
            -{' '}
            {layoutEngine.formatHourMinute(
              Math.floor(endMinutes / 60),
              endMinutes % 60,
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface SelectionRendererProps {
  createSelection: { startMinute: number; endMinute: number } | null
  config: ViewConfig
  layoutEngine?: InstanceType<typeof EventLayoutEngineClass>
}

export function SelectionRenderer({
  createSelection,
  config,
  layoutEngine: providedLayoutEngine,
}: SelectionRendererProps) {
  if (!createSelection || !config) return null

  const layoutEngine =
    providedLayoutEngine ?? EventLayoutEngineClass.create(config)

  return (
    <div
      className="absolute left-0 right-0 rounded-lg bg-[#0066FF]/15 border border-[#0066FF]/40 pointer-events-none"
      style={{
        top: `${Math.min(createSelection.startMinute, createSelection.endMinute)}px`,
        height: `${Math.max(Math.abs(createSelection.endMinute - createSelection.startMinute), 15)}px`,
        zIndex: 5,
      }}
    >
      <div className="px-2 pt-1 text-xs font-medium text-[#0066FF]">
        {formatSelectionRange(
          createSelection.startMinute,
          createSelection.endMinute,
          (hour, min) => layoutEngine.formatHourMinute(hour, min),
        )}
      </div>
    </div>
  )
}

interface CurrentTimeIndicatorProps {
  date: Date
  config: ViewConfig
  currentTime: Date
  _isDark?: boolean
}

export function CurrentTimeIndicator({
  date,
  config,
  currentTime,
  _isDark,
}: CurrentTimeIndicatorProps) {
  if (!config) return null
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()

  if (!isToday) return null

  const currentTimeInTimezone = new Date(
    currentTime.toLocaleString('en-US', {
      timeZone: config.timezone,
    }),
  )
  const currentHours = currentTimeInTimezone.getHours()
  const currentMinutes = currentTimeInTimezone.getMinutes()

  const topPosition = currentHours * 60 + currentMinutes

  return (
    <div
      className="absolute left-0 right-0 border-t-2 border-[#0066FF] z-30 pointer-events-none"
      style={{
        top: `${topPosition}px`,
      }}
    >
      <span className="absolute -left-1.5 -top-[5px] h-2.5 w-2.5 rounded-full bg-[#0066FF]" />
    </div>
  )
}
