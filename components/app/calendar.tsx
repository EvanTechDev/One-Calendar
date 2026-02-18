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
  Command as CommandIcon,
  CalendarPlus,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  CalendarFold,
  ChartColumn,
  UserRoundCog,
  PlusCircle,
  FolderPlus,
  FolderMinus,
  Share2,
  BookmarkPlus,
  BookmarkX,
  Pencil,
  Copy,
  Link2,
  ChevronLeftCircle,
  ChevronRightCircle,
  Languages,
  Palette,
  SunMoon,
  Clock3,
  BellRing,
  LogOut,
  LifeBuoy,
  MessageSquare,
  Activity,
  Keyboard,
  Trash2,
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
import { getLanguageAutonym, supportedLanguages, translations, type Language, useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useClerk } from "@clerk/nextjs";
import { useTheme } from "next-themes";
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
  const { events, setEvents, calendars, addCategory, removeCategory } = useCalendar();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<
    string[]
  >([]);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [language, setLanguage] = useLanguage();
  const t = translations[language];
  const { signOut } = useClerk();
  const { setTheme } = useTheme();
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
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandMode, setCommandMode] = useState<
    | "root"
    | "language"
    | "theme"
    | "first-day"
    | "time-format"
    | "default-view"
    | "shortcuts"
    | "calendar-view"
  >("root");

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
        case "k":
        case "K":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            setIsCommandOpen((prev) => !prev);
          }
          break;
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

  const openQuickCreateDialog = () => {
    setSelectedEvent(null);
    setQuickCreateStartTime(new Date());
    setEventDialogOpen(true);
    setIsCommandOpen(false);
  };

  const handleSetView = (nextView: ViewType) => {
    setView(nextView);
    setIsCommandOpen(false);
  };

  const goToToday = () => {
    handleTodayClick();
    setIsCommandOpen(false);
  };

  const getPrimaryEvent = () => {
    if (previewEvent) return previewEvent;
    if (searchResultEvents.length > 0) return searchResultEvents[0];
    if (filteredEvents.length > 0) return filteredEvents[0];
    return null;
  };

  const openEventForShare = (event: CalendarEvent | null) => {
    if (!event) {
      toast.error(t.commandNeedEvent || "Please select an event first");
      return;
    }
    setPreviewEvent(event);
    setPreviewOpen(true);
    setOpenShareImmediately(true);
    setIsCommandOpen(false);
  };

  const editPrimaryEvent = () => {
    const event = getPrimaryEvent();
    if (!event) {
      toast.error(t.commandNeedEvent || "Please select an event first");
      return;
    }
    setPreviewEvent(event);
    setSelectedEvent(event);
    setQuickCreateStartTime(null);
    setPreviewOpen(false);
    setEventDialogOpen(true);
    setIsCommandOpen(false);
  };

  const deletePrimaryEvent = () => {
    const event = getPrimaryEvent();
    if (!event) {
      toast.error(t.commandNeedEvent || "Please select an event first");
      return;
    }
    handleEventDelete(event.id);
    setIsCommandOpen(false);
  };

  const duplicatePrimaryEvent = () => {
    const event = getPrimaryEvent();
    if (!event) {
      toast.error(t.commandNeedEvent || "Please select an event first");
      return;
    }
    handleEventDuplicate(event);
    setIsCommandOpen(false);
  };

  const copyPrimaryEventTitle = async () => {
    const event = getPrimaryEvent();
    if (!event) {
      toast.error(t.commandNeedEvent || "Please select an event first");
      return;
    }
    await navigator.clipboard.writeText(event.title || t.unnamedEvent);
    toast.success(t.commandTitleCopied || "Event title copied");
    setIsCommandOpen(false);
  };

  const togglePrimaryBookmark = async (mode: "add" | "remove") => {
    const event = getPrimaryEvent();
    if (!event) {
      toast.error(t.commandNeedEvent || "Please select an event first");
      return;
    }

    const bookmarks = await readEncryptedLocalStorage<any[]>("bookmarked-events", []);
    const hasBookmark = bookmarks.some((b: any) => b.id === event.id);

    if (mode === "add" && !hasBookmark) {
      await toggleBookmark(event);
      toast.success(t.bookmarkAdded);
    } else if (mode === "remove" && hasBookmark) {
      await toggleBookmark(event);
      toast.success(t.bookmarkRemoved);
    } else {
      toast(t.commandNoChange || "No changes needed");
    }

    setIsCommandOpen(false);
  };

  const createCalendarCategoryFromPrompt = () => {
    const name = window.prompt(t.commandCategoryNamePrompt || "Category name");
    if (!name) return;

    const id = `${name.toLowerCase().trim().replace(/\s+/g, "-")}-${Date.now()}`;
    const colors = ["bg-blue-500", "bg-green-500", "bg-orange-500", "bg-purple-500", "bg-pink-500"];
    const color = colors[Math.floor(Math.random() * colors.length)];

    addCategory({ id, name: name.trim(), color, keywords: [] });
    toast.success(t.commandCategoryCreated || "Calendar category created");
    setIsCommandOpen(false);
  };

  const deleteCalendarCategoryFromPrompt = () => {
    if (calendars.length === 0) {
      toast.error(t.commandNoCategories || "No calendar categories to delete");
      return;
    }

    const available = calendars.map((cal) => cal.name).join(", ");
    const input = window.prompt(`${t.commandCategoryDeletePrompt || "Type category name to delete"}: ${available}`);
    if (!input) return;

    const target = calendars.find(
      (cal) => cal.name.toLowerCase() === input.trim().toLowerCase(),
    );

    if (!target) {
      toast.error(t.commandCategoryNotFound || "Category not found");
      return;
    }

    removeCategory(target.id);
    toast.success(t.commandCategoryDeleted || "Calendar category deleted");
    setIsCommandOpen(false);
  };

  const copyPrimarySharedLink = async () => {
    const event = getPrimaryEvent();
    if (!event) {
      toast.error(t.commandNeedEvent || "Please select an event first");
      return;
    }

    const shares = await readEncryptedLocalStorage<any[]>("shared-events", []);
    const targetShare = [...shares].reverse().find((item) => item.eventId === event.id && item.shareLink);

    if (!targetShare?.shareLink) {
      toast.error(t.commandNoSharedLink || "No shared link found for this event");
      return;
    }

    await navigator.clipboard.writeText(targetShare.shareLink);
    toast.success(t.linkCopied);
    setIsCommandOpen(false);
  };

  const deletePrimaryShare = async () => {
    const event = getPrimaryEvent();
    if (!event) {
      toast.error(t.commandNeedEvent || "Please select an event first");
      return;
    }

    const shares = await readEncryptedLocalStorage<any[]>("shared-events", []);
    const targetShare = [...shares].reverse().find((item) => item.eventId === event.id);

    if (!targetShare?.id) {
      toast.error(t.commandNoSharedLink || "No shared link found for this event");
      return;
    }

    try {
      const res = await fetch("/api/share", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: targetShare.id }),
      });

      if (!res.ok) {
        throw new Error("Failed to delete share");
      }

      await writeEncryptedLocalStorage(
        "shared-events",
        shares.filter((item) => item.id !== targetShare.id),
      );
      toast.success(t.shareDeleted);
    } catch {
      toast.error(t.shareDeleteFailed || "Failed to delete share");
    }

    setIsCommandOpen(false);
  };

  const openSupport = () => {
    window.open("mailto:support@xyehr.cn", "_blank");
    setIsCommandOpen(false);
  };

  const sendFeedback = () => {
    const subject = encodeURIComponent("One Calendar Feedback");
    window.open(`mailto:support@xyehr.cn?subject=${subject}`, "_blank");
    setIsCommandOpen(false);
  };

  const openCalendarStatus = () => {
    window.open("https://calendarstatus.xyehr.cn", "_blank");
    setIsCommandOpen(false);
  };

  const openShortcutGuide = () => {
    setEnableShortcuts(true);
    setView("settings");
    setIsCommandOpen(false);
  };

  const switchTheme = (nextTheme: string) => {
    setTheme(nextTheme);
    toast.success(t.commandThemeUpdated || "Theme updated");
    setIsCommandOpen(false);
  };

  const switchLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    toast.success(t.commandLanguageUpdated || "Language updated");
    setIsCommandOpen(false);
    setCommandMode("root");
  };

  const openLanguageCommandMode = () => {
    setCommandMode("language");
  };

  const openThemeCommandMode = () => setCommandMode("theme");
  const openFirstDayCommandMode = () => setCommandMode("first-day");
  const openTimeFormatCommandMode = () => setCommandMode("time-format");
  const openDefaultViewCommandMode = () => setCommandMode("default-view");
  const openShortcutsCommandMode = () => setCommandMode("shortcuts");
  const openCalendarViewCommandMode = () => setCommandMode("calendar-view");

  const toggleShortcuts = (enabled: boolean) => {
    setEnableShortcuts(enabled);
    toast.success(enabled ? t.commandShortcutsEnabled || "Shortcuts enabled" : t.commandShortcutsDisabled || "Shortcuts disabled");
    setIsCommandOpen(false);
  };

  const doSignOut = async () => {
    await signOut();
    setIsCommandOpen(false);
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

  const handleTimeSlotClick = (clickTime: Date) => {
    setQuickCreateStartTime(clickTime);

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
          <header className="flex items-center justify-between px-4 h-16 border-b relative z-40 bg-background">
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={toggleSidebar} size="sm">
                <PanelLeft />
              </Button>
              <Button variant="outline" size="sm" onClick={handleTodayClick}>
                {t.today || "今天"}
              </Button>
            </div>

            <div className="flex items-center space-x-2">
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

            <div className="flex items-center space-x-2">
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
                onClick={() => setIsCommandOpen(true)}
                aria-label={t.commandPalette || "Command palette"}
              >
                <CommandIcon className="h-4 w-4" />
              </Button>
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
                onTimeSlotClick={handleTimeSlotClick}
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
                onTimeSlotClick={handleTimeSlotClick}
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
                onTimeSlotClick={handleTimeSlotClick}
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

        <CommandDialog
          open={isCommandOpen}
          onOpenChange={(open) => {
            setIsCommandOpen(open);
            if (!open) {
              setCommandMode("root");
            }
          }}
          title={t.commandPalette || "Command palette"}
          description={
            t.commandPaletteDescription ||
            "Quickly jump to any calendar feature"
          }
        >
          <CommandInput
            placeholder={
              commandMode === "root"
                ? t.commandPalettePlaceholder ||
                  "Type a command or search for a feature..."
                : `${t.searchEvents}...`
            }
          />
          {commandMode === "language" ? (
            <CommandList>
              <CommandEmpty>{t.noData || "No data"}</CommandEmpty>
              <CommandGroup heading={t.language}>
                <CommandItem onSelect={() => setCommandMode("root")}>
                  <ChevronLeftCircle className="h-4 w-4" />
                  <span>{t.previousStep || "Back"}</span>
                </CommandItem>
                {supportedLanguages.map((langOption) => (
                  <CommandItem
                    key={langOption}
                    onSelect={() => switchLanguage(langOption)}
                  >
                    <Languages className="h-4 w-4" />
                    <span>{getLanguageAutonym(langOption)}</span>
                    {langOption === language && <CommandShortcut>✓</CommandShortcut>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          ) : commandMode === "theme" ? (
            <CommandList>
              <CommandGroup heading={t.theme}>
                <CommandItem onSelect={() => setCommandMode("root")}>
                  <ChevronLeftCircle className="h-4 w-4" />
                  <span>{t.previousStep || "Back"}</span>
                </CommandItem>
                <CommandItem onSelect={() => switchTheme("light")}><Palette className="h-4 w-4" /><span>{t.themeLight}</span></CommandItem>
                <CommandItem onSelect={() => switchTheme("dark")}><Palette className="h-4 w-4" /><span>{t.themeDark}</span></CommandItem>
                <CommandItem onSelect={() => switchTheme("green")}><Palette className="h-4 w-4" /><span>{t.themeGreen}</span></CommandItem>
                <CommandItem onSelect={() => switchTheme("orange")}><Palette className="h-4 w-4" /><span>{t.themeOrange}</span></CommandItem>
                <CommandItem onSelect={() => switchTheme("azalea")}><Palette className="h-4 w-4" /><span>{t.themeAzalea}</span></CommandItem>
                <CommandItem onSelect={() => switchTheme("system")}><SunMoon className="h-4 w-4" /><span>{t.themeSystem}</span></CommandItem>
              </CommandGroup>
            </CommandList>
          ) : commandMode === "first-day" ? (
            <CommandList>
              <CommandGroup heading={t.firstDayOfWeek}>
                <CommandItem onSelect={() => setCommandMode("root")}><ChevronLeftCircle className="h-4 w-4" /><span>{t.previousStep || "Back"}</span></CommandItem>
                <CommandItem onSelect={() => { setFirstDayOfWeek(0); setIsCommandOpen(false); }}><CalendarDays className="h-4 w-4" /><span>{t.sunday}</span></CommandItem>
                <CommandItem onSelect={() => { setFirstDayOfWeek(1); setIsCommandOpen(false); }}><CalendarDays className="h-4 w-4" /><span>{t.monday}</span></CommandItem>
              </CommandGroup>
            </CommandList>
          ) : commandMode === "time-format" ? (
            <CommandList>
              <CommandGroup heading={t.timeFormat}>
                <CommandItem onSelect={() => setCommandMode("root")}><ChevronLeftCircle className="h-4 w-4" /><span>{t.previousStep || "Back"}</span></CommandItem>
                <CommandItem onSelect={() => { setTimeFormat("24h"); setIsCommandOpen(false); }}><Clock3 className="h-4 w-4" /><span>{t.timeFormat24h}</span></CommandItem>
                <CommandItem onSelect={() => { setTimeFormat("12h"); setIsCommandOpen(false); }}><Clock3 className="h-4 w-4" /><span>{t.timeFormat12hWithMeridiem}</span></CommandItem>
              </CommandGroup>
            </CommandList>
          ) : commandMode === "default-view" ? (
            <CommandList>
              <CommandGroup heading={t.defaultView}>
                <CommandItem onSelect={() => setCommandMode("root")}><ChevronLeftCircle className="h-4 w-4" /><span>{t.previousStep || "Back"}</span></CommandItem>
                <CommandItem onSelect={() => { setDefaultView("day"); setIsCommandOpen(false); }}><CalendarDays className="h-4 w-4" /><span>{t.day}</span></CommandItem>
                <CommandItem onSelect={() => { setDefaultView("week"); setIsCommandOpen(false); }}><CalendarRange className="h-4 w-4" /><span>{t.week}</span></CommandItem>
                <CommandItem onSelect={() => { setDefaultView("four-day"); setIsCommandOpen(false); }}><CalendarFold className="h-4 w-4" /><span>{t.fourDay}</span></CommandItem>
                <CommandItem onSelect={() => { setDefaultView("month"); setIsCommandOpen(false); }}><CalendarDays className="h-4 w-4" /><span>{t.month}</span></CommandItem>
                <CommandItem onSelect={() => { setDefaultView("year"); setIsCommandOpen(false); }}><CalendarDays className="h-4 w-4" /><span>{t.year}</span></CommandItem>
              </CommandGroup>
            </CommandList>
          ) : commandMode === "shortcuts" ? (
            <CommandList>
              <CommandGroup heading={t.enableShortcuts}>
                <CommandItem onSelect={() => setCommandMode("root")}><ChevronLeftCircle className="h-4 w-4" /><span>{t.previousStep || "Back"}</span></CommandItem>
                <CommandItem onSelect={() => toggleShortcuts(true)}><Keyboard className="h-4 w-4" /><span>{t.enableShortcuts}</span></CommandItem>
                <CommandItem onSelect={() => toggleShortcuts(false)}><Keyboard className="h-4 w-4" /><span>{"Disable shortcuts"}</span></CommandItem>
              </CommandGroup>
            </CommandList>
          ) : commandMode === "calendar-view" ? (
            <CommandList>
              <CommandGroup heading={t.view}>
                <CommandItem onSelect={() => setCommandMode("root")}><ChevronLeftCircle className="h-4 w-4" /><span>{t.previousStep || "Back"}</span></CommandItem>
                <CommandItem onSelect={() => handleSetView("day")}><CalendarDays className="h-4 w-4" /><span>{t.day}</span></CommandItem>
                <CommandItem onSelect={() => handleSetView("week")}><CalendarRange className="h-4 w-4" /><span>{t.week}</span></CommandItem>
                <CommandItem onSelect={() => handleSetView("four-day")}><CalendarFold className="h-4 w-4" /><span>{t.fourDay}</span></CommandItem>
                <CommandItem onSelect={() => handleSetView("month")}><CalendarDays className="h-4 w-4" /><span>{t.month}</span></CommandItem>
                <CommandItem onSelect={() => handleSetView("year")}><CalendarDays className="h-4 w-4" /><span>{t.year}</span></CommandItem>
                <CommandItem onSelect={() => handleSetView("analytics")}><ChartColumn className="h-4 w-4" /><span>{t.analytics}</span></CommandItem>
                <CommandItem onSelect={() => handleSetView("settings")}><UserRoundCog className="h-4 w-4" /><span>{t.settings}</span></CommandItem>
              </CommandGroup>
            </CommandList>
          ) : (
          <CommandList>
            <CommandEmpty>{t.noMatchingEvents || "No results found."}</CommandEmpty>

            <CommandGroup heading={t.createEvent}>
              <CommandItem onSelect={openQuickCreateDialog}>
                <PlusCircle className="h-4 w-4" />
                <span>{t.newEvent}</span>
                <CommandShortcut>N</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={createCalendarCategoryFromPrompt}>
                <FolderPlus className="h-4 w-4" />
                <span>{t.addCategory}</span>
              </CommandItem>
              <CommandItem onSelect={() => openEventForShare(getPrimaryEvent())}>
                <Share2 className="h-4 w-4" />
                <span>{t.shareEvent}</span>
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading={t.events}>
              <CommandItem onSelect={editPrimaryEvent}>
                <Pencil className="h-4 w-4" />
                <span>{t.update}</span>
              </CommandItem>
              <CommandItem onSelect={deletePrimaryEvent}>
                <Trash2 className="h-4 w-4" />
                <span>{t.delete}</span>
              </CommandItem>
              <CommandItem onSelect={duplicatePrimaryEvent}>
                <Copy className="h-4 w-4" />
                <span>{t.copy || "Copy"} {t.title || "Title"}</span>
              </CommandItem>
              <CommandItem onSelect={copyPrimaryEventTitle}>
                <Copy className="h-4 w-4" />
                <span>{`${t.copy} ${t.title}`}</span>
              </CommandItem>
              <CommandItem onSelect={() => togglePrimaryBookmark("add")}>
                <BookmarkPlus className="h-4 w-4" />
                <span>{t.bookmark}</span>
              </CommandItem>
              <CommandItem onSelect={() => togglePrimaryBookmark("remove")}>
                <BookmarkX className="h-4 w-4" />
                <span>{t.unbookmark}</span>
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading={t.share}>
              <CommandItem onSelect={copyPrimarySharedLink}>
                <Link2 className="h-4 w-4" />
                <span>{t.copyLink}</span>
              </CommandItem>
              <CommandItem onSelect={deletePrimaryShare}>
                <Trash2 className="h-4 w-4" />
                <span>{t.deleteShare}</span>
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading={t.view}>
              <CommandItem onSelect={goToToday}>
                <CalendarIcon className="h-4 w-4" />
                <span>{t.today}</span>
              </CommandItem>
              <CommandItem onSelect={handlePrevious}>
                <ChevronLeftCircle className="h-4 w-4" />
                <span>{t.previousPeriod}</span>
              </CommandItem>
              <CommandItem onSelect={handleNext}>
                <ChevronRightCircle className="h-4 w-4" />
                <span>{t.nextPeriod}</span>
              </CommandItem>
              <CommandItem onSelect={openCalendarViewCommandMode}>
                <CalendarRange className="h-4 w-4" />
                <span>{t.view}</span>
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading={t.settings}>
              <CommandItem onSelect={openThemeCommandMode}>
                <Palette className="h-4 w-4" />
                <span>{t.theme}</span>
              </CommandItem>
              <CommandItem onSelect={openLanguageCommandMode}>
                <Languages className="h-4 w-4" />
                <span>{t.language}</span>
              </CommandItem>
              <CommandItem onSelect={openFirstDayCommandMode}>
                <CalendarDays className="h-4 w-4" />
                <span>{t.firstDayOfWeek}</span>
              </CommandItem>
              <CommandItem onSelect={openTimeFormatCommandMode}>
                <Clock3 className="h-4 w-4" />
                <span>{t.timeFormat}</span>
              </CommandItem>
              <CommandItem onSelect={openDefaultViewCommandMode}>
                <CalendarRange className="h-4 w-4" />
                <span>{t.defaultView}</span>
              </CommandItem>
              <CommandItem onSelect={() => { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); setIsCommandOpen(false); }}>
                <BellRing className="h-4 w-4" />
                <span>{t.timezone}</span>
              </CommandItem>
              <CommandItem onSelect={openShortcutsCommandMode}>
                <Keyboard className="h-4 w-4" />
                <span>{t.enableShortcuts}</span>
              </CommandItem>
              <CommandItem onSelect={openShortcutGuide}>
                <Keyboard className="h-4 w-4" />
                <span>{t.availableShortcuts}</span>
              </CommandItem>
              <CommandItem onSelect={deleteCalendarCategoryFromPrompt}>
                <FolderMinus className="h-4 w-4" />
                <span>{`${t.delete} ${t.categoryName}`}</span>
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading={t.account}>
              <CommandItem onSelect={openSupport}>
                <LifeBuoy className="h-4 w-4" />
                <span>{t.commandContactSupport || "Contact support"}</span>
              </CommandItem>
              <CommandItem onSelect={sendFeedback}>
                <MessageSquare className="h-4 w-4" />
                <span>{t.commandSendFeedback || "Send feedback"}</span>
              </CommandItem>
              <CommandItem onSelect={openCalendarStatus}>
                <Activity className="h-4 w-4" />
                <span>{t.commandCalendarStatus || "Calendar status"}</span>
              </CommandItem>
              <CommandItem onSelect={doSignOut}>
                <LogOut className="h-4 w-4" />
                <span>{t.logout}</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
          )}
        </CommandDialog>

        <EventDialog
          open={eventDialogOpen}
          onOpenChange={setEventDialogOpen}
          onEventAdd={handleEventAdd}
          onEventUpdate={handleEventUpdate}
          onEventDelete={handleEventDelete}
          initialDate={quickCreateStartTime || date}
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
