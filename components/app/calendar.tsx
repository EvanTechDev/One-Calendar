"use client";

import {
  checkPendingNotifications,
  clearAllNotificationTimers,
  type NOTIFICATION_SOUNDS,
} from "@/lib/notifications";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  PanelLeft,
  BarChart2,
  Settings as SettingsIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  readEncryptedLocalStorage,
  useLocalStorage,
  writeEncryptedLocalStorage,
} from "@/hooks/useLocalStorage";
import UserProfileButton, {
  type UserProfileSection,
} from "@/components/app/profile/user-profile-button";
import { useState, useEffect, useRef, useMemo } from "react";
import { useCalendar } from "@/components/providers/calendar-context";
import RightSidebar from "@/components/app/sidebar/right-sidebar";
import { addDays, addYears, subDays, subYears } from "date-fns";
import EventPreview from "@/components/app/event/event-preview";
import EventDialog from "@/components/app/event/event-dialog";
import DailyToast from "@/components/app/profile/daily-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import Sidebar from "@/components/app/sidebar/sidebar";
import { translations, useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const loadDayView = () => import("@/components/app/views/day-view");
const loadWeekView = () => import("@/components/app/views/week-view");
const loadMonthView = () => import("@/components/app/views/month-view");
const loadYearView = () => import("@/components/app/views/year-view");
const loadAnalyticsView = () =>
  import("@/components/app/analytics/analytics-view");
const loadSettings = () => import("@/components/app/profile/settings");

const DayView = dynamic(loadDayView);
const WeekView = dynamic(loadWeekView);
const MonthView = dynamic(loadMonthView);
const YearView = dynamic(loadYearView);
const AnalyticsView = dynamic(loadAnalyticsView);
const Settings = dynamic(loadSettings);

type ViewType =
  | "day"
  | "week"
  | "four-day"
  | "month"
  | "year"
  | "analytics"
  | "settings";

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly";
  location?: string;
  participants: string[];
  notification: number;
  description?: string;
  color: string;
  calendarId: string;
}

export default function Calendar({ className, ...props }: CalendarProps) {
  const [openShareImmediately, setOpenShareImmediately] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarExpanding, setIsSidebarExpanding] = useState(false);
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<ViewType>("week");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const { events, setEvents, calendars } = useCalendar();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<
    string[]
  >([]);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [language, setLanguage] = useLanguage();
  const t = translations[language];
  const [firstDayOfWeek, setFirstDayOfWeek] = useLocalStorage<number>(
    "first-day-of-week",
    0,
  );
  const [timezone, setTimezone] = useLocalStorage<string>(
    "timezone",
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [notificationSound, setNotificationSound] = useLocalStorage<
    keyof typeof NOTIFICATION_SOUNDS
  >("notification-sound", "telegram");
  const notificationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationsInitializedRef = useRef(false);
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [focusUserProfileSection, setFocusUserProfileSection] =
    useState<UserProfileSection | null>(null);
  const [sidebarDate, setSidebarDate] = useState<Date>(new Date());
  const [pendingDeleteEvent, setPendingDeleteEvent] =
    useState<CalendarEvent | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const updateEvent = (updatedEvent) => {
    setEvents((prevEvents) =>
      prevEvents.map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event,
      ),
    );
  };

  const [quickCreateStartTime, setQuickCreateStartTime] = useState<Date | null>(
    null,
  );
  const [quickCreateEndTime, setQuickCreateEndTime] = useState<Date | null>(
    null,
  );

  const [defaultView, setDefaultView] = useLocalStorage<ViewType>(
    "default-view",
    "week",
  );
  const [enableShortcuts, setEnableShortcuts] = useLocalStorage<boolean>(
    "enable-shortcuts",
    true,
  );
  const [timeFormat, setTimeFormat] = useLocalStorage<"24h" | "12h">(
    "time-format",
    "24h",
  );

  useEffect(() => {
    if (view !== defaultView) {
      setView(defaultView as ViewType);
    }
  }, []);

  useEffect(() => {
    const prefetch = () => {
      void loadDayView();
      void loadWeekView();
      void loadMonthView();
      void loadYearView();
      void loadAnalyticsView();
      void loadSettings();
    };

    if (typeof window === "undefined") return;

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch);
      return () => window.cancelIdleCallback(id);
    }

    const timeoutId = window.setTimeout(prefetch, 800);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!enableShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      switch (e.key) {
        case "n":
        case "N":
          e.preventDefault();
          setSelectedEvent(null);
          setQuickCreateStartTime(new Date());
          setEventDialogOpen(true);
          break;
        case "/":
          e.preventDefault();

          const searchInput = document.querySelector(
            'input[placeholder="' + t.searchEvents + '"]',
          ) as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
          break;
        case "t":
        case "T":
          e.preventDefault();
          handleTodayClick();
          break;
        case "1":
          e.preventDefault();
          setView("day");
          break;
        case "2":
          e.preventDefault();
          setView("week");
          break;
        case "3":
          e.preventDefault();
          setView("month");
          break;
        case "4":
          e.preventDefault();
          setView("year");
          break;
        case "5":
          e.preventDefault();
          setView("four-day");
          break;
        case "ArrowRight":
          e.preventDefault();
          handleNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handlePrevious();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enableShortcuts, t.searchEvents]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const nextCollapsed = !prev;
      if (!nextCollapsed) {
        setIsSidebarExpanding(true);
      } else {
        setIsSidebarExpanding(false);
      }
      return nextCollapsed;
    });
  };

  const handleDateSelect = (date: Date) => {
    setDate(date);
    setSidebarDate(date);
  };

  const handleViewChange = (newView: ViewType) => {
    setView(newView);
  };

  const handleUserProfileSectionNavigate = (section: UserProfileSection) => {
    setView("settings");
    setFocusUserProfileSection(null);
    setTimeout(() => setFocusUserProfileSection(section), 0);
  };

  const handleTodayClick = () => {
    const today = new Date();
    setDate(today);
    setSidebarDate(today);
  };

  const handlePrevious = () => {
    setDate((prevDate) => {
      if (view === "day") return subDays(prevDate, 1);
      if (view === "week") return subDays(prevDate, 7);
      if (view === "four-day") return subDays(prevDate, 4);
      if (view === "year") return subYears(prevDate, 1);
      return subDays(prevDate, 30);
    });
  };

  const handleNext = () => {
    setDate((prevDate) => {
      if (view === "day") return addDays(prevDate, 1);
      if (view === "week") return addDays(prevDate, 7);
      if (view === "four-day") return addDays(prevDate, 4);
      if (view === "year") return addYears(prevDate, 1);
      return addDays(prevDate, 30);
    });
  };

  const formatDateDisplay = (date: Date) => {
    if (view === "year") {
      return date.getFullYear().toString();
    }

    if (view === "four-day") {
      const startDate = new Date(date);
      const endDate = addDays(startDate, 3);
      const options: Intl.DateTimeFormatOptions = {
        month: "short",
        day: "numeric",
      };
      return `${startDate.toLocaleDateString(language, options)} - ${endDate.toLocaleDateString(language, options)}`;
    }

    if (language === "en") {
      const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "long",
      };
      return date.toLocaleDateString(language, options);
    } else {
      const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "long",
      };
      return date.toLocaleDateString(language, options);
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    setPreviewEvent(event);
    setPreviewOpen(true);
  };

  const handleEventAdd = (event: CalendarEvent) => {
    const newEvent = {
      ...event,
      id:
        event.id ||
        Date.now().toString() + Math.random().toString(36).substring(2, 9),
    };

    setEvents((prevEvents) => [...prevEvents, newEvent]);
    toast(t.eventCreated);
    setEventDialogOpen(false);
    setSelectedEvent(null);
    setQuickCreateStartTime(null);
  };

  const handleEventUpdate = (updatedEvent: CalendarEvent) => {
    setEvents((prevEvents) =>
      prevEvents.map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event,
      ),
    );
    toast(t.eventUpdated);
    setEventDialogOpen(false);
    setSelectedEvent(null);
    setQuickCreateStartTime(null);
  };

  const handleEventDelete = (eventId: string) => {
    const targetEvent = events.find((event) => event.id === eventId);
    if (!targetEvent) return;
    setPendingDeleteEvent(targetEvent);
    setDeleteConfirmOpen(true);
  };

  const confirmEventDelete = () => {
    if (!pendingDeleteEvent) return;

    const deletedEvent = pendingDeleteEvent;
    setEvents((prevEvents) =>
      prevEvents.filter((event) => event.id !== deletedEvent.id),
    );
    setEventDialogOpen(false);
    setSelectedEvent(null);
    setPreviewOpen(false);
    setDeleteConfirmOpen(false);
    setPendingDeleteEvent(null);

    toast(t.eventDeleted, {
      description: deletedEvent.title,
      action: {
        label: t.undo,
        onClick: () => {
          setEvents((prevEvents) => {
            if (prevEvents.some((event) => event.id === deletedEvent.id))
              return prevEvents;
            return [...prevEvents, deletedEvent].sort(
              (a, b) =>
                new Date(a.startDate).getTime() -
                new Date(b.startDate).getTime(),
            );
          });
          toast(t.deletionUndone);
        },
      },
    });
  };

  const handleImportEvents = (importedEvents: CalendarEvent[]) => {
    const newEvents = importedEvents.map((event) => ({
      ...event,
      id: event.id || Math.random().toString(36).substring(7),
    })) as CalendarEvent[];
    setEvents((prevEvents) => [...prevEvents, ...newEvents]);
  };

  const handleEventEdit = () => {
    if (previewEvent) {
      setSelectedEvent(previewEvent);
      setQuickCreateStartTime(null);
      setEventDialogOpen(true);
      setPreviewOpen(false);
    }
  };

  const handleEventDuplicate = (event: CalendarEvent) => {
    const duplicatedEvent = {
      ...event,
      id: Math.random().toString(36).substring(7),
    };
    setEvents((prevEvents) => [...prevEvents, duplicatedEvent]);
    setPreviewOpen(false);
  };

  const handleTimeRangeSelect = (startTime: Date, endTime?: Date) => {
    setQuickCreateStartTime(startTime);
    setQuickCreateEndTime(endTime ?? null);

    setSelectedEvent(null);
    setEventDialogOpen(true);
  };

  const toggleBookmark = async (event: CalendarEvent) => {
    const bookmarks = await readEncryptedLocalStorage<any[]>(
      "bookmarked-events",
      [],
    );

    const isBookmarked = bookmarks.some((b: any) => b.id === event.id);
    if (isBookmarked) {
      const updated = bookmarks.filter((b: any) => b.id !== event.id);
      await writeEncryptedLocalStorage("bookmarked-events", updated);
    } else {
      const bookmarkData = {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        color: event.color,
        location: event.location,
        bookmarkedAt: new Date().toISOString(),
      };
      await writeEncryptedLocalStorage("bookmarked-events", [
        ...bookmarks,
        bookmarkData,
      ]);
    }
  };

  const handleShare = (event: CalendarEvent) => {
    setPreviewEvent(event);
    setPreviewOpen(true);
  };

  const eventsByCategory = useMemo(() => {
    if (selectedCategoryFilters.length === 0) return events;

    return events.filter((event) => {
      if (!event.calendarId) {
        return selectedCategoryFilters.includes("__uncategorized__");
      }

      const hasCategory = calendars.some((cal) => cal.id === event.calendarId);
      if (!hasCategory)
        return selectedCategoryFilters.includes("__uncategorized__");
      return selectedCategoryFilters.includes(event.calendarId);
    });
  }, [events, selectedCategoryFilters, calendars]);

  const filteredEvents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return eventsByCategory;

    return eventsByCategory
      .filter((event) => {
        const title = event.title?.toLowerCase() || "";
        const location = event.location?.toLowerCase() || "";
        const description = event.description?.toLowerCase() || "";
        return (
          title.includes(keyword) ||
          location.includes(keyword) ||
          description.includes(keyword)
        );
      })
      .sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      );
  }, [eventsByCategory, searchTerm]);

  const searchResultEvents = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return filteredEvents.slice(0, 8);
  }, [filteredEvents, searchTerm]);

  useEffect(() => {
    if (!notificationsInitializedRef.current) {
      checkPendingNotifications(notificationSound);
      notificationsInitializedRef.current = true;
    }

    if (!notificationIntervalRef.current) {
      notificationIntervalRef.current = setInterval(() => {
        checkPendingNotifications(notificationSound);
      }, 60000);
    }

    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
      }
    };
  }, [notificationSound]);

  useEffect(() => {
    window.addEventListener("beforeunload", clearAllNotificationTimers);
    return () => {
      window.removeEventListener("beforeunload", clearAllNotificationTimers);
    };
  }, []);

  return (
    <div className={className}>
      <div className="relative flex h-dvh overflow-hidden bg-background">
        {}
        <Sidebar
          onCreateEvent={() => {
            setSelectedEvent(null);
            setQuickCreateStartTime(new Date());
            setEventDialogOpen(true);
          }}
          onDateSelect={handleDateSelect}
          onViewChange={handleViewChange}
          language={language}
          selectedDate={sidebarDate}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onCollapseTransitionEnd={() => setIsSidebarExpanding(false)}
          selectedCategoryFilters={selectedCategoryFilters}
          onCategoryFilterChange={(categoryId, checked) => {
            setSelectedCategoryFilters((prev) => {
              if (checked) {
                return prev.includes(categoryId) ? prev : [...prev, categoryId];
              }
              return prev.filter((id) => id !== categoryId);
            });
          }}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col pr-14">
          {" "}
          <header className="flex items-center px-4 h-16 border-b relative z-40 bg-background">
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={toggleSidebar} size="sm">
                <PanelLeft />
              </Button>
              <Button variant="outline" size="sm" onClick={handleTodayClick}>
                {t.today || "今天"}
              </Button>
              {view !== "analytics" && view !== "settings" && (
                <>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handlePrevious}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleNext}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="text-lg">{formatDateDisplay(date)}</span>
                </>
              )}
            </div>

            <div className="ml-auto flex items-center space-x-2">
              <div className="relative z-50">
                <Select
                  value={
                    view === "day" ||
                    view === "week" ||
                    view === "four-day" ||
                    view === "month" ||
                    view === "year"
                      ? view
                      : defaultView === "day" ||
                          defaultView === "week" ||
                          defaultView === "four-day" ||
                          defaultView === "month" ||
                          defaultView === "year"
                        ? defaultView
                        : "week"
                  }
                  onValueChange={(value: ViewType) => setView(value)}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="day">{t.day}</SelectItem>
                      <SelectItem value="week">{t.week}</SelectItem>
                      <SelectItem value="month">{t.month}</SelectItem>
                      <SelectItem value="year">{t.year}</SelectItem>
                      <SelectItem value="four-day">{t.fourDay}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative z-50">
                <Search className="pointer-events-none h-5 w-5 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder={t.searchEvents}
                  value={searchTerm}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    window.setTimeout(() => setIsSearchFocused(false), 120);
                  }}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchResultEvents.length > 0) {
                      setPreviewEvent(searchResultEvents[0]);
                      setPreviewOpen(true);
                      setSearchTerm("");
                      setIsSearchFocused(false);
                    }
                  }}
                  className="pl-9 pr-4 py-2 w-48"
                />
                {isSearchFocused && !!searchTerm && (
                  <div className="absolute right-0 top-[calc(100%+6px)] w-72 rounded-md border bg-popover p-1 shadow-md z-50">
                    {searchResultEvents.length > 0 ? (
                      <ScrollArea className="max-h-[320px]">
                        <div className="space-y-1">
                          {searchResultEvents.map((event) => (
                            <button
                              key={event.id}
                              type="button"
                              className="w-full cursor-pointer rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setPreviewEvent(event);
                                setPreviewOpen(true);
                                setSearchTerm("");
                                setIsSearchFocused(false);
                              }}
                            >
                              <div className="font-medium leading-none">
                                {event.title || t.unnamedEvent}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {formatDateDisplay(new Date(event.startDate))}
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {t.noMatchingEvents}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full h-8 w-8"
                onClick={() => setView("analytics")}
                aria-label={t.analytics}
              >
                <BarChart2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full h-8 w-8"
                onClick={() => setView("settings")}
                aria-label={t.settings}
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
              <UserProfileButton
                variant="outline"
                className="rounded-full h-8 w-8"
                onNavigateToSettings={handleUserProfileSectionNavigate}
              />
            </div>
          </header>
          <div className="flex-1 overflow-auto" ref={calendarRef}>
            {view === "day" && (
              <DayView
                date={date}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onTimeSlotClick={handleTimeRangeSelect}
                language={language}
                timezone={timezone}
                timeFormat={timeFormat}
                onEditEvent={handleEventEdit}
                onDeleteEvent={(event) => handleEventDelete(event.id)}
                onShareEvent={(event) => {
                  setPreviewEvent(event);
                  setPreviewOpen(true);
                  setOpenShareImmediately(true);
                }}
                onBookmarkEvent={toggleBookmark}
                onEventDrop={(event, newStartDate, newEndDate) => {
                  const updatedEvent = {
                    ...event,
                    startDate: newStartDate,
                    endDate: newEndDate,
                  };

                  updateEvent(updatedEvent);
                }}
              />
            )}
            {view === "week" && (
              <WeekView
                date={date}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onTimeSlotClick={handleTimeRangeSelect}
                language={language}
                firstDayOfWeek={firstDayOfWeek}
                timezone={timezone}
                timeFormat={timeFormat}
                onEditEvent={handleEventEdit}
                onDeleteEvent={(event) => handleEventDelete(event.id)}
                onShareEvent={(event) => {
                  setPreviewEvent(event);
                  setPreviewOpen(true);
                  setOpenShareImmediately(true);
                }}
                onBookmarkEvent={toggleBookmark}
                onEventDrop={(event, newStartDate, newEndDate) => {
                  const updatedEvent = {
                    ...event,
                    startDate: newStartDate,
                    endDate: newEndDate,
                  };

                  updateEvent(updatedEvent);
                }}
              />
            )}
            {view === "four-day" && (
              <WeekView
                date={date}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onTimeSlotClick={handleTimeRangeSelect}
                language={language}
                firstDayOfWeek={firstDayOfWeek}
                timezone={timezone}
                timeFormat={timeFormat}
                onEditEvent={handleEventEdit}
                onDeleteEvent={(event) => handleEventDelete(event.id)}
                onShareEvent={(event) => {
                  setPreviewEvent(event);
                  setPreviewOpen(true);
                  setOpenShareImmediately(true);
                }}
                onBookmarkEvent={toggleBookmark}
                onEventDrop={(event, newStartDate, newEndDate) => {
                  const updatedEvent = {
                    ...event,
                    startDate: newStartDate,
                    endDate: newEndDate,
                  };

                  updateEvent(updatedEvent);
                }}
                daysToShow={4}
                fixedStartDate={date}
              />
            )}
            {view === "month" && (
              <MonthView
                date={date}
                events={filteredEvents}
                onEventClick={handleEventClick}
                language={language}
                firstDayOfWeek={firstDayOfWeek}
                timezone={timezone}
              />
            )}
            {view === "year" && (
              <YearView
                date={date}
                events={filteredEvents}
                onEventClick={handleEventClick}
                language={language}
                firstDayOfWeek={firstDayOfWeek}
                isSidebarCollapsed={isSidebarCollapsed}
                isSidebarExpanding={isSidebarExpanding}
              />
            )}
            {view === "analytics" && (
              <AnalyticsView
                events={events}
                onCreateEvent={(startDate, endDate) => {
                  setSelectedEvent(null);
                  setQuickCreateStartTime(startDate);
                  setEventDialogOpen(true);
                }}
              />
            )}
            {view === "settings" && (
              <Settings
                language={language}
                setLanguage={setLanguage}
                firstDayOfWeek={firstDayOfWeek}
                setFirstDayOfWeek={setFirstDayOfWeek}
                timezone={timezone}
                setTimezone={setTimezone}
                notificationSound={notificationSound}
                setNotificationSound={setNotificationSound}
                defaultView={defaultView}
                setDefaultView={setDefaultView}
                enableShortcuts={enableShortcuts}
                setEnableShortcuts={setEnableShortcuts}
                timeFormat={timeFormat}
                setTimeFormat={setTimeFormat}
                events={events}
                onImportEvents={handleImportEvents}
                focusUserProfileSection={focusUserProfileSection}
              />
            )}
          </div>
        </div>

        {}
        <RightSidebar
          onViewChange={handleViewChange}
          onEventClick={handleEventClick}
        />

        {}
        <EventPreview
          event={previewEvent}
          open={previewOpen}
          onOpenChange={(open) => {
            setPreviewOpen(open);
            if (!open) setOpenShareImmediately(false);
          }}
          onEdit={handleEventEdit}
          onDelete={() => {
            if (previewEvent) {
              handleEventDelete(previewEvent.id);
              setPreviewOpen(false);
            }
          }}
          onDuplicate={handleEventDuplicate}
          language={language}
          timezone={timezone}
          openShareImmediately={openShareImmediately}
        />

        <EventDialog
          open={eventDialogOpen}
          onOpenChange={setEventDialogOpen}
          onEventAdd={handleEventAdd}
          onEventUpdate={handleEventUpdate}
          onEventDelete={handleEventDelete}
          initialDate={quickCreateStartTime || date}
          initialEndDate={quickCreateEndTime}
          event={selectedEvent}
          language={language}
          timezone={timezone}
        />

        <DailyToast />

        <AlertDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.deleteEventConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.deleteEventConfirmDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingDeleteEvent(null)}>
                {t.cancel}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground"
                onClick={confirmEventDelete}
              >
                {t.delete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
