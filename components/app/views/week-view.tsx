"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Edit3, Share2, Bookmark, Trash2 } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isWithinInterval,
  add,
  addDays,
  startOfDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import { translations, type Language } from "@/lib/i18n";

interface WeekViewProps {
  date: Date;
  events: any[];
  onEventClick: (event: any) => void;
  onTimeSlotClick: (startDate: Date, endDate?: Date) => void;
  language: Language;
  firstDayOfWeek: number;
  timezone: string;
  timeFormat: "24h" | "12h";
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (event: CalendarEvent) => void;
  onShareEvent?: (event: CalendarEvent) => void;
  onBookmarkEvent?: (event: CalendarEvent) => void;
  onEventDrop?: (
    event: CalendarEvent,
    newStartDate: Date,
    newEndDate: Date,
  ) => void;
  daysToShow?: number;
  fixedStartDate?: Date;
}

interface CalendarEvent {
  id: string;
  startDate: string | Date;
  endDate: string | Date;
  title: string;
  color: string;
  isAllDay?: boolean;
}

export default function WeekView({
  date,
  events,
  onEventClick,
  onTimeSlotClick,
  language,
  firstDayOfWeek,
  timezone,
  timeFormat,
  onEditEvent,
  onDeleteEvent,
  onShareEvent,
  onBookmarkEvent,
  onEventDrop,
  daysToShow,
  fixedStartDate,
}: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: firstDayOfWeek });
  const weekEnd = endOfWeek(date, { weekStartsOn: firstDayOfWeek });
  const weekDays = daysToShow
    ? Array.from({ length: daysToShow }, (_, index) =>
        addDays(startOfDay(fixedStartDate ?? date), index),
      )
    : eachDayOfInterval({ start: weekStart, end: weekEnd });
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const gridTemplateColumns = `100px repeat(${weekDays.length}, minmax(0, 1fr))`;
  const today = new Date();
  const t = translations[language];

  const [currentTime, setCurrentTime] = useState(new Date());
  const hasScrolledRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [dragStartPosition, setDragStartPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [dragPreview, setDragPreview] = useState<{
    day: Date;
    hour: number;
    minute: number;
  } | null>(null);
  const [dragEventDuration, setDragEventDuration] = useState<number>(0);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);

  const [createSelection, setCreateSelection] = useState<{
    dayIndex: number;
    startMinute: number;
    endMinute: number;
  } | null>(null);
  const createStartRef = useRef<{ dayIndex: number; minute: number } | null>(null);
  const isCreatingRef = useRef(false);
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  const menuLabels = {
    edit: t.edit,
    share: t.share,
    bookmark: t.bookmark,
    delete: t.delete,
  };

  function getDarkerColorClass(color: string) {
    const colorMapping: Record<string, string> = {
      "bg-[#E6F6FD]": "#3B82F6",
      "bg-[#E7F8F2]": "#10B981",
      "bg-[#FEF5E6]": "#F59E0B",
      "bg-[#FFE4E6]": "#EF4444",
      "bg-[#F3EEFE]": "#8B5CF6",
      "bg-[#FCE7F3]": "#EC4899",
      "bg-[#EEF2FF]": "#6366F1",
      "bg-[#FFF0E5]": "#FB923C",
      "bg-[#E6FAF7]": "#14B8A6",
    };

    return colorMapping[color] || "#3A3A3A";
  }

  function getEventBackgroundColor(color: string) {
    if (!isDark) return undefined;

    const darkModeColorMapping: Record<string, string> = {
      "bg-[#E6F6FD]": "#2F4655",
      "bg-[#E7F8F2]": "#2D4935",
      "bg-[#FEF5E6]": "#4F3F1B",
      "bg-[#FFE4E6]": "#6C2920",
      "bg-[#F3EEFE]": "#483A63",
      "bg-[#FCE7F3]": "#5A334A",
      "bg-[#E6FAF7]": "#1F4A47",
    };

    return darkModeColorMapping[color];
  }

  useEffect(() => {
    if (!hasScrolledRef.current && scrollContainerRef.current) {
      const now = new Date();
      const currentHour = now.getHours();

      const hourElements =
        scrollContainerRef.current.querySelectorAll(".h-\\[60px\\]");
      if (hourElements.length > 0 && currentHour < hourElements.length) {
        const currentHourElement = hourElements[currentHour + 1];

        if (currentHourElement) {
          scrollContainerRef.current.scrollTo({
            top: (currentHourElement as HTMLElement).offsetTop - 100,
            behavior: "auto",
          });

          hasScrolledRef.current = true;
        }
      }
    }
  }, [date, weekDays]);

  useEffect(() => {
    setCurrentTime(new Date());

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (
        draggingEvent &&
        isDraggingRef.current &&
        dragStartPosition &&
        scrollContainerRef.current
      ) {
        const containerRect =
          scrollContainerRef.current.getBoundingClientRect();
        const gridItems =
          scrollContainerRef.current.querySelectorAll(".grid-col");

        let closestDayIndex = 0;
        let minDistance = Infinity;

        gridItems.forEach((item, index) => {
          const rect = item.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const distance = Math.abs(e.clientX - centerX);

          if (distance < minDistance) {
            minDistance = distance;
            closestDayIndex = index;
          }
        });

        const relativeY =
          e.clientY - containerRect.top + scrollContainerRef.current.scrollTop;
        const hour = Math.floor(relativeY / 60);
        const minute = Math.floor((relativeY % 60) / 15) * 15;

        if (closestDayIndex < weekDays.length) {
          setDragPreview({
            day: weekDays[closestDayIndex],
            hour: hour,
            minute: minute,
          });
        }
      }
    };

    const handleMouseUp = () => {
      if (
        draggingEvent &&
        isDraggingRef.current &&
        dragPreview &&
        onEventDrop
      ) {
        const newStartDate = new Date(dragPreview.day);
        newStartDate.setHours(dragPreview.hour, dragPreview.minute, 0, 0);

        const newEndDate = add(newStartDate, { minutes: dragEventDuration });

        onEventDrop(draggingEvent, newStartDate, newEndDate);
      }

      isDraggingRef.current = false;
      setDraggingEvent(null);
      setDragStartPosition(null);
      setDragOffset(null);
      setDragPreview(null);
    };

    if (draggingEvent) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    draggingEvent,
    dragStartPosition,
    dragPreview,
    onEventDrop,
    weekDays,
    dragEventDuration,
  ]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isCreatingRef.current || !createStartRef.current) return;
      const endMinute = getMinutesFromMousePosition(event.clientY);
      setCreateSelection({
        dayIndex: createStartRef.current.dayIndex,
        startMinute: createStartRef.current.minute,
        endMinute,
      });
    };

    const handleMouseUp = () => {
      if (!isCreatingRef.current || !createStartRef.current) return;

      const { dayIndex, minute } = createStartRef.current;
      const startMinute = Math.min(minute, createSelection?.endMinute ?? minute);
      const endMinute = Math.max(minute, createSelection?.endMinute ?? minute);
      const day = weekDays[dayIndex];

      if (day) {
        const startDate = new Date(day);
        startDate.setHours(0, startMinute, 0, 0);

        const effectiveEndMinute = endMinute === startMinute ? startMinute + 30 : endMinute;
        const endDate = new Date(day);
        endDate.setHours(0, Math.min(effectiveEndMinute, 24 * 60), 0, 0);

        onTimeSlotClick(startDate, endDate);
      }

      isCreatingRef.current = false;
      createStartRef.current = null;
      setCreateSelection(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [createSelection, onTimeSlotClick, weekDays]);

  const formatTime = (hour: number) => {
    if (timeFormat === "12h") {
      const period = hour >= 12 ? "PM" : "AM";
      const twelveHour = hour % 12 || 12;
      return `${twelveHour} ${period}`;
    }
    return `${hour.toString().padStart(2, "0")}:00`;
  };

  const formatHourMinute = (hour: number, minute: number) => {
    if (timeFormat === "12h") {
      const period = hour >= 12 ? "PM" : "AM";
      const twelveHour = hour % 12 || 12;
      return `${twelveHour}:${minute.toString().padStart(2, "0")} ${period}`;
    }
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  };

  const formatDateWithTimezone = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: timeFormat === "12h",
      timeZone: timezone,
    };
    return new Intl.DateTimeFormat(language, options).format(date);
  };

  const isAllDayEvent = (event: CalendarEvent) => {
    if (event.isAllDay) return true;

    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    const isFullDay =
      start.getHours() === 0 &&
      start.getMinutes() === 0 &&
      ((end.getHours() === 23 && end.getMinutes() === 59) ||
        (end.getHours() === 0 &&
          end.getMinutes() === 0 &&
          end.getDate() !== start.getDate()));

    return isFullDay;
  };

  const isMultiDayEvent = (start: Date, end: Date) => {
    if (!start || !end) return false;

    return (
      start.getDate() !== end.getDate() ||
      start.getMonth() !== end.getMonth() ||
      start.getFullYear() !== end.getFullYear()
    );
  };

  const shouldShowEventOnDay = (event: CalendarEvent, day: Date) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    if (isAllDayEvent(event) && isMultiDayEvent(start, end)) {
      return isSameDay(start, day);
    }

    if (isSameDay(start, day)) return true;

    if (isMultiDayEvent(start, end) && !isAllDayEvent(event)) {
      return isWithinInterval(day, { start, end });
    }

    return false;
  };

  const getEventTimesForDay = (event: CalendarEvent, day: Date) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    if (!start || !end) return null;

    const isMultiDay = isMultiDayEvent(start, end);

    let dayStart = start;
    let dayEnd = end;

    if (isMultiDay) {
      if (!isSameDay(start, day)) {
        dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
      }

      if (!isSameDay(end, day)) {
        dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);
      }
    }

    return {
      start: dayStart,
      end: dayEnd,
      isMultiDay,
    };
  };

  const separateEvents = (dayEvents: CalendarEvent[], day: Date) => {
    const allDayEvents: CalendarEvent[] = [];
    const regularEvents: CalendarEvent[] = [];

    dayEvents.forEach((event) => {
      if (isAllDayEvent(event)) {
        allDayEvents.push(event);
      } else {
        regularEvents.push(event);
      }
    });

    return { allDayEvents, regularEvents };
  };

  const layoutEventsForDay = (dayEvents: CalendarEvent[], day: Date) => {
    if (!dayEvents || dayEvents.length === 0) return [];

    const eventsWithTimes = dayEvents
      .map((event) => {
        const times = getEventTimesForDay(event, day);
        if (!times) return null;
        return { event, ...times };
      })
      .filter(Boolean) as Array<{
      event: CalendarEvent;
      start: Date;
      end: Date;
      isMultiDay: boolean;
    }>;

    eventsWithTimes.sort((a, b) => a.start.getTime() - b.start.getTime());

    type TimePoint = { time: number; isStart: boolean; eventIndex: number };
    const timePoints: TimePoint[] = [];

    eventsWithTimes.forEach((eventWithTime, index) => {
      const startTime = eventWithTime.start.getTime();
      const endTime = eventWithTime.end.getTime();

      timePoints.push({ time: startTime, isStart: true, eventIndex: index });
      timePoints.push({ time: endTime, isStart: false, eventIndex: index });
    });

    timePoints.sort((a, b) => {
      if (a.time === b.time) {
        return a.isStart ? 1 : -1;
      }
      return a.time - b.time;
    });

    const eventLayouts: Array<{
      event: CalendarEvent;
      start: Date;
      end: Date;
      column: number;
      totalColumns: number;
      isMultiDay: boolean;
    }> = [];

    const activeEvents = new Set<number>();

    const eventToColumn = new Map<number, number>();

    for (let i = 0; i < timePoints.length; i++) {
      const point = timePoints[i];

      if (point.isStart) {
        activeEvents.add(point.eventIndex);

        let column = 0;
        const usedColumns = new Set<number>();

        activeEvents.forEach((eventIndex) => {
          if (eventToColumn.has(eventIndex)) {
            usedColumns.add(eventToColumn.get(eventIndex)!);
          }
        });

        while (usedColumns.has(column)) {
          column++;
        }

        eventToColumn.set(point.eventIndex, column);
      } else {
        activeEvents.delete(point.eventIndex);
      }

      if (
        i === timePoints.length - 1 ||
        timePoints[i + 1].time !== point.time
      ) {
        const totalColumns =
          activeEvents.size > 0
            ? Math.max(
                ...Array.from(activeEvents).map(
                  (idx) => eventToColumn.get(idx)!,
                ),
              ) + 1
            : 0;

        activeEvents.forEach((eventIndex) => {
          const column = eventToColumn.get(eventIndex)!;
          const { event, start, end, isMultiDay } = eventsWithTimes[eventIndex];

          const existingLayout = eventLayouts.find(
            (layout) => layout.event.id === event.id,
          );

          if (!existingLayout) {
            eventLayouts.push({
              event,
              start,
              end,
              column,
              totalColumns: Math.max(totalColumns, 1),
              isMultiDay,
            });
          }
        });
      }
    }

    return eventLayouts;
  };

  const handleEventDragStart = (event: CalendarEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    longPressTimeoutRef.current = setTimeout(() => {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);

      const durationMs = end.getTime() - start.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));

      setDraggingEvent(event);
      setDragStartPosition({ x: e.clientX, y: e.clientY });
      setDragEventDuration(durationMinutes);
      isDraggingRef.current = true;
    }, 300);
  };

  const handleEventDragEnd = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const snapToQuarterHour = (minutes: number) => {
    const clamped = Math.min(Math.max(minutes, 0), 24 * 60);
    return Math.round(clamped / 15) * 15;
  };

  const getMinutesFromMousePosition = (clientY: number) => {
    if (!scrollContainerRef.current) return 0;
    const containerRect = scrollContainerRef.current.getBoundingClientRect();
    return snapToQuarterHour(
      clientY - containerRect.top + scrollContainerRef.current.scrollTop,
    );
  };

  const handleGridMouseDown = (
    dayIndex: number,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0 || draggingEvent) return;

    const startMinute = getMinutesFromMousePosition(event.clientY);
    createStartRef.current = { dayIndex, minute: startMinute };
    isCreatingRef.current = true;
    setCreateSelection({ dayIndex, startMinute, endMinute: startMinute });
  };

  const renderAllDayEvents = (day: Date, allDayEvents: CalendarEvent[]) => {
    const eventSpacing = 2;

    return allDayEvents.map((event, index) => (
      <ContextMenu
        key={`allday-${event.id}-${day.toISOString().split("T")[0]}`}
      >
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "relative rounded-lg p-1 text-xs cursor-pointer overflow-hidden",
              event.color,
            )}
            style={{
              height: "20px",

              top: index * (20 + eventSpacing) + "px",
              position: "absolute",
              left: "0",
              right: "0",
              opacity: isDark ? 1 : 0.9,
              backgroundColor: getEventBackgroundColor(event.color),
              zIndex: 10 + index,
            }}
            onMouseDown={(e) => handleEventDragStart(event, e)}
            onMouseUp={handleEventDragEnd}
            onMouseLeave={handleEventDragEnd}
            onClick={(e) => {
              e.stopPropagation();
              if (!isDraggingRef.current) {
                onEventClick(event);
              }
            }}
          >
            <div
              className={cn("absolute left-0 top-0 w-1 h-full rounded-l-md")}
              style={{ backgroundColor: getDarkerColorClass(event.color) }}
            />
            <div
              className="pl-1.5 truncate"
              style={{ color: getDarkerColorClass(event.color) }}
            >
              {event.title}
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-40">
          <ContextMenuItem onSelect={(e) => { e.preventDefault(); onEditEvent?.(event); }}>
            <Edit3 className="mr-2 h-4 w-4" />
            {menuLabels.edit}
          </ContextMenuItem>
          <ContextMenuItem onSelect={(e) => { e.preventDefault(); onShareEvent?.(event); }}>
            <Share2 className="mr-2 h-4 w-4" />
            {menuLabels.share}
          </ContextMenuItem>
          <ContextMenuItem onSelect={(e) => { e.preventDefault(); onBookmarkEvent?.(event); }}>
            <Bookmark className="mr-2 h-4 w-4" />
            {menuLabels.bookmark}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={(e) => { e.preventDefault(); onDeleteEvent?.(event); }}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {menuLabels.delete}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    ));
  };

  const renderDragPreview = () => {
    if (!dragPreview || !draggingEvent) return null;

    const dayIndex = weekDays.findIndex((day) =>
      isSameDay(day, dragPreview.day),
    );
    if (dayIndex === -1) return null;

    const startMinutes = dragPreview.hour * 60 + dragPreview.minute;
    const endMinutes = startMinutes + dragEventDuration;

    return (
      <div
        className={cn(
          "absolute rounded-lg p-2 text-sm cursor-pointer overflow-hidden",
          draggingEvent.color,
        )}
        style={{
          top: `${startMinutes}px`,
          height: `${dragEventDuration}px`,
          opacity: 0.6,
          width: `calc(100% - 4px)`,
          left: "2px",
          zIndex: 100,
          border: "2px dashed white",
          pointerEvents: "none",
        }}
      >
        <div
          className={cn("absolute left-0 top-0 w-1 h-full rounded-l-md")}
          style={{ backgroundColor: getDarkerColorClass(draggingEvent.color) }}
        />
        <div className="pl-1">
          <div
            className="font-medium truncate"
            style={{ color: getDarkerColorClass(draggingEvent.color) }}
          >
            {draggingEvent.title}
          </div>
          {dragEventDuration >= 40 && (
            <div className="text-xs text-white/90 truncate">
              {formatHourMinute(dragPreview.hour, dragPreview.minute)} -{" "}
              {formatHourMinute(Math.floor(endMinutes / 60), endMinutes % 60)}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="grid divide-x relative z-30 bg-background"
        style={{ gridTemplateColumns }}
      >
        <div className="sticky top-0 z-30 bg-background" />
        {weekDays.map((day) => {
          const dayEvents = events.filter((event) =>
            shouldShowEventOnDay(event, day),
          );

          const { allDayEvents } = separateEvents(dayEvents, day);

          const eventSpacing = 2;
          const allDayEventsHeight =
            allDayEvents.length > 0
              ? allDayEvents.length * 20 +
                (allDayEvents.length - 1) * eventSpacing
              : 0;

          return (
            <div
              key={day.toString()}
              className="sticky top-0 z-30 bg-background"
            >
              <div className="p-2 text-center">
                <div>{t.weekdays[day.getDay()]}</div>
                {}
                <div
                  className={cn(
                    isSameDay(day, today)
                      ? "text-[#0066FF] font-bold green:text-[#24a854] orange:text-[#e26912] azalea:text-[#CD2F7B]"
                      : "",
                  )}
                >
                  {format(day, "d")}
                </div>
              </div>

              {}
              <div
                className="relative"
                style={{ height: allDayEventsHeight + "px" }}
              >
                {renderAllDayEvents(day, allDayEvents)}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="flex-1 grid divide-x overflow-auto"
        style={{ gridTemplateColumns }}
        ref={scrollContainerRef}
      >
        <div className="text-sm text-muted-foreground">
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] relative border-gray-200">
              <span
                className={cn(
                  "absolute right-4",
                  hour === 0 ? "top-0" : "top-0 -translate-y-1/2",
                )}
              >
                {formatTime(hour)}
              </span>
            </div>
          ))}
        </div>

        {weekDays.map((day, dayIndex) => {
          const dayEvents = events.filter((event) =>
            shouldShowEventOnDay(event, day),
          );

          const { regularEvents } = separateEvents(dayEvents, day);

          const eventLayouts = layoutEventsForDay(regularEvents, day);

          return (
            <div
              key={day.toString()}
              className="relative border-l grid-col"
              onMouseDown={(event) => handleGridMouseDown(dayIndex, event)}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-[60px] border-t"
                />
              ))}

              {eventLayouts.map(
                ({ event, start, end, column, totalColumns }) => {
                  const startMinutes =
                    start.getHours() * 60 + start.getMinutes();
                  const endMinutes = end.getHours() * 60 + end.getMinutes();
                  const duration = endMinutes - startMinutes;

                  const minHeight = 20;
                  const height = Math.max(duration, minHeight);

                  const width = `calc((100% - 4px) / ${totalColumns})`;
                  const left = `calc(${column} * ${width})`;

                  return (
                    <ContextMenu
                      key={`${event.id}-${day.toISOString().split("T")[0]}`}
                    >
                      <ContextMenuTrigger asChild>
                        <div
                          className={cn(
                            "relative absolute rounded-lg p-2 text-sm cursor-pointer overflow-hidden",
                            event.color,
                          )}
                          style={{
                            top: `${startMinutes}px`,
                            height: `${height}px`,
                            opacity: isDark ? 1 : 0.92,
                            backgroundColor: getEventBackgroundColor(
                              event.color,
                            ),
                            width,
                            left,
                            zIndex: column + 1,
                          }}
                          onMouseDown={(e) => handleEventDragStart(event, e)}
                          onMouseUp={handleEventDragEnd}
                          onMouseLeave={handleEventDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isDraggingRef.current) {
                              onEventClick(event);
                            }
                          }}
                        >
                          <div
                            className={cn(
                              "absolute left-0 top-0 w-1 h-full rounded-l-md",
                            )}
                            style={{
                              backgroundColor: getDarkerColorClass(event.color),
                            }}
                          />
                          <div className="pl-1">
                            <div
                              className="font-medium leading-tight break-words"
                              style={{
                                color: getDarkerColorClass(event.color),
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: Math.max(
                                  1,
                                  Math.floor((height - 8) / 16),
                                ),
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {event.title}
                            </div>
                            {height >= 40 && (
                              <div
                                className="text-xs truncate"
                                style={{
                                  color: getDarkerColorClass(event.color),
                                }}
                              >
                                {formatDateWithTimezone(start)} -{" "}
                                {formatDateWithTimezone(end)}
                              </div>
                            )}
                          </div>
                        </div>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-40">
                        <ContextMenuItem onSelect={(e) => { e.preventDefault(); onEditEvent?.(event); }}>
                          <Edit3 className="mr-2 h-4 w-4" />
                          {menuLabels.edit}
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={(e) => { e.preventDefault(); onShareEvent?.(event); }}>
                          <Share2 className="mr-2 h-4 w-4" />
                          {menuLabels.share}
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={(e) => { e.preventDefault(); onBookmarkEvent?.(event); }}
                        >
                          <Bookmark className="mr-2 h-4 w-4" />
                          {menuLabels.bookmark}
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={(e) => { e.preventDefault(); onDeleteEvent?.(event); }}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {menuLabels.delete}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                },
              )}

              {createSelection && createSelection.dayIndex === dayIndex && (
                <div
                  className="absolute left-0 right-0 bg-[#0066FF]/15 border border-[#0066FF]/40 pointer-events-none green:bg-[#24a854]/15 green:border-[#24a854]/40 orange:bg-[#e26912]/15 orange:border-[#e26912]/40 azalea:bg-[#CD2F7B]/15 azalea:border-[#CD2F7B]/40"
                  style={{
                    top: `${Math.min(createSelection.startMinute, createSelection.endMinute)}px`,
                    height: `${Math.max(Math.abs(createSelection.endMinute - createSelection.startMinute), 15)}px`,
                    zIndex: 5,
                  }}
                />
              )}

              {}
              {dragPreview &&
                isSameDay(dragPreview.day, day) &&
                renderDragPreview()}

              {isSameDay(day, today) &&
                (() => {
                  const currentTimeInTimezone = new Date(
                    currentTime.toLocaleString("en-US", { timeZone: timezone }),
                  );
                  const currentHours = currentTimeInTimezone.getHours();
                  const currentMinutes = currentTimeInTimezone.getMinutes();

                  const topPosition = currentHours * 60 + currentMinutes;

                  return (
                    <div
                      className="absolute left-0 right-0 border-t-2 border-[#0066FF] z-0 green:border-[#24a854] orange:border-[#e26912] azalea:border-[#CD2F7B]"
                      style={{
                        top: `${topPosition}px`,
                      }}
                    >
                      <span className="absolute -left-1.5 -top-[5px] h-2.5 w-2.5 rounded-full bg-[#0066FF] green:bg-[#24a854] orange:bg-[#e26912] azalea:bg-[#CD2F7B]" />
                    </div>
                  );
                })()}
            </div>
          );
        })}
      </div>

      {}
      {draggingEvent && (
        <div
          className="fixed px-2 py-1 bg-black text-white rounded-md text-xs z-50 pointer-events-none"
          style={{
            left: dragOffset
              ? dragStartPosition!.x + dragOffset.x + 10
              : dragStartPosition!.x + 10,
            top: dragOffset
              ? dragStartPosition!.y + dragOffset.y + 10
              : dragStartPosition!.y + 10,
            opacity: 0.8,
          }}
        >
          {t.dragToNewPosition}
        </div>
      )}
    </div>
  );
}
