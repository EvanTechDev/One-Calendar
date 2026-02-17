import {
  format,
  startOfWeek,
  addDays,
  startOfYear,
  endOfYear,
  isSameDay,
  parseISO,
  getDay,
  differenceInDays,
} from "date-fns";
import {
  getEncryptionState,
  readEncryptedLocalStorage,
  subscribeEncryptionState,
} from "@/hooks/useLocalStorage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isZhLanguage, translations, useLanguage } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import React, { useEffect, useState } from "react";

interface CalendarEvent {
  id: string;
  title: string;
  isAllDay: boolean;
  startDate: string;
  endDate: string;
  calendarId: string;
  color: string;
  description: string;
  location: string;
  notification: number;
  participants: any[];
  recurrence: string;
}

const EventsCalendar: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [language] = useLanguage();
  const t = translations[language];
  const isZh = isZhLanguage(language);

  useEffect(() => {
    let active = true;
    const loadEvents = () =>
      readEncryptedLocalStorage<CalendarEvent[]>("calendar-events", []).then(
        (parsedEvents) => {
          if (!active) return;
          setEvents(parsedEvents);

          const years = new Set<number>();
          parsedEvents.forEach((event) => {
            const startYear = new Date(event.startDate).getFullYear();
            const endYear = new Date(event.endDate).getFullYear();
            for (let year = startYear; year <= endYear; year++) {
              years.add(year);
            }
          });

          const sortedYears = Array.from(years).sort();
          setAvailableYears(sortedYears);

          if (sortedYears.length > 0) {
            const currentYear = new Date().getFullYear();

            const closestYear = sortedYears.reduce((prev, curr) =>
              Math.abs(curr - currentYear) < Math.abs(prev - currentYear)
                ? curr
                : prev,
            );
            setSelectedYear(closestYear);
          }
        },
      );

    loadEvents();
    const unsubscribe = subscribeEncryptionState(() => {
      if (getEncryptionState().ready) {
        loadEvents();
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const getEventCountForDay = (day: Date) => {
    return events.filter((event) => {
      const startDate = parseISO(event.startDate);
      const endDate = parseISO(event.endDate);

      return (
        isSameDay(day, startDate) ||
        isSameDay(day, endDate) ||
        (day > startDate && day < endDate)
      );
    }).length;
  };

  const getColorIntensity = (count: number) => {
    if (count === 0) return "bg-gray-100 dark:bg-gray-800";
    if (count === 1) return "bg-emerald-100 dark:bg-emerald-900";
    if (count === 2) return "bg-emerald-300 dark:bg-emerald-700";
    if (count === 3) return "bg-emerald-500 dark:bg-emerald-600";
    return "bg-emerald-700 dark:bg-emerald-500";
  };

  const formatMonthLabel = (date: Date) => {
    const monthIndex = date.getMonth();

    return t.months[monthIndex];
  };

  const renderCalendarGrid = () => {
    if (availableYears.length === 0) {
      return (
        <div className="text-gray-500 dark:text-gray-400">
          {t.noEventsFound}
        </div>
      );
    }

    const firstDayOfYear = startOfYear(new Date(selectedYear, 0, 1));
    const lastDayOfYear = endOfYear(new Date(selectedYear, 11, 31));

    const startDay = startOfWeek(firstDayOfYear);

    const endDay = addDays(lastDayOfYear, 6 - getDay(lastDayOfYear));

    const totalDays = differenceInDays(endDay, startDay) + 1;

    const totalWeeks = Math.ceil(totalDays / 7);

    const allDates = [];
    for (let i = 0; i < totalDays; i++) {
      allDates.push(addDays(startDay, i));
    }

    const monthLabels = [];
    for (let month = 0; month < 12; month++) {
      const firstDayOfMonth = new Date(selectedYear, month, 1);

      if (firstDayOfMonth >= startDay && firstDayOfMonth <= endDay) {
        const dayIndex = differenceInDays(firstDayOfMonth, startDay);
        const weekIndex = Math.floor(dayIndex / 7);
        monthLabels.push({
          label: formatMonthLabel(firstDayOfMonth),
          weekIndex: weekIndex,
        });
      }
    }

    const cellSize = 15;
    const cellGap = 3;
    const cellWithGap = cellSize + cellGap;

    const monthLabelOffset = 48;

    return (
      <div className="relative">
        <div className="flex items-center mb-6">
          <h2 className="text-lg font-semibold mr-4">{t.eventsCalendar}</h2>
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(Number(value))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder={t.selectYear} />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto pb-2">
          <div
            style={{
              position: "relative",
              paddingTop: "20px",
              minWidth: `${Math.max(totalWeeks * cellWithGap, 720)}px`,
            }}
          >
            {}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
              {monthLabels.map((month, i) => (
                <div
                  key={`month-${i}`}
                  className="text-xs text-gray-500 dark:text-gray-400 absolute"
                  style={{
                    left: `${month.weekIndex * cellWithGap + monthLabelOffset}px`,
                  }}
                >
                  {month.label}
                </div>
              ))}
            </div>

            {}
            <div className="flex">
              {}
              <div className="flex flex-col pr-2">
                {t.weekdays.map((day, i) => (
                  <div
                    key={`day-${i}`}
                    className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end"
                    style={{
                      height: `${cellSize}px`,
                      marginBottom: `${cellGap}px`,
                    }}
                  >
                    {i % 2 === 0 ? day : ""}
                  </div>
                ))}
              </div>

              {}
              <div style={{ display: "flex" }}>
                {Array.from({ length: totalWeeks }).map((_, weekIndex) => (
                  <div
                    key={`week-${weekIndex}`}
                    style={{ marginRight: `${cellGap}px` }}
                  >
                    {Array.from({ length: 7 }).map((_, dayIndex) => {
                      const dateIndex = weekIndex * 7 + dayIndex;
                      const date = allDates[dateIndex];
                      const isCurrentYear = date.getFullYear() === selectedYear;

                      const eventCount = isCurrentYear
                        ? getEventCountForDay(date)
                        : 0;
                      const colorClass = getColorIntensity(eventCount);

                      return (
                        <div
                          key={`cell-${weekIndex}-${dayIndex}`}
                          className={`rounded-sm ${isCurrentYear ? colorClass : "bg-transparent"} cursor-pointer hover:ring-1 hover:ring-gray-400 dark:hover:ring-gray-500 transition-colors duration-200`}
                          style={{
                            width: `${cellSize}px`,
                            height: `${cellSize}px`,
                            marginBottom: `${cellGap}px`,
                          }}
                          title={
                            isCurrentYear
                              ? `${format(date, "yyyy-MM-dd")}: ${eventCount} ${isZh ? "个事件" : "events"}`
                              : ""
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center mt-2 text-xs text-gray-600 dark:text-gray-300">
          <span className="mr-2">{t.less}</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800"></div>
            <div className="w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900"></div>
            <div className="w-3 h-3 rounded-sm bg-emerald-300 dark:bg-emerald-700"></div>
            <div className="w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-600"></div>
            <div className="w-3 h-3 rounded-sm bg-emerald-700 dark:bg-emerald-500"></div>
          </div>
          <span className="ml-2">{t.more}</span>
        </div>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4">{renderCalendarGrid()}</CardContent>
    </Card>
  );
};

export default EventsCalendar;
