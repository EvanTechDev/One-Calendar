export interface TimeCategory {
  id: string;
  name: string;
  color: string;
  keywords: string[];
}

export interface TimeAnalytics {
  totalEvents: number;
  totalHours: number;
  categorizedHours: Record<string, number>;
  mostProductiveDay: string;
  mostProductiveHour: number;
  averageEventDuration: number;
  activeDays: number;
  busiestCategoryId: string;
  longestEvent: {
    title: string;
    duration: number;
  };
}

export function analyzeTimeUsage(
  events: any[],
  categories: TimeCategory[] = [],
): TimeAnalytics {
  const result: TimeAnalytics = {
    totalEvents: events.length,
    totalHours: 0,
    categorizedHours: {},
    mostProductiveDay: "",
    mostProductiveHour: 0,
    averageEventDuration: 0,
    activeDays: 0,
    busiestCategoryId: "uncategorized",
    longestEvent: {
      title: "",
      duration: 0,
    },
  };

  categories.forEach((category) => {
    result.categorizedHours[category.id] = 0;
  });
  result.categorizedHours["uncategorized"] = 0;

  const eventsByDay: Record<string, number> = {};
  const eventsByHour: Record<number, number> = {};
  for (let i = 0; i < 24; i++) {
    eventsByHour[i] = 0;
  }

  events.forEach((event) => {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const durationHours =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    result.totalHours += durationHours;

    if (durationHours > result.longestEvent.duration) {
      result.longestEvent = {
        title: event.title,
        duration: durationHours,
      };
    }

    const dayKey = startDate.toISOString().split("T")[0];
    eventsByDay[dayKey] = (eventsByDay[dayKey] || 0) + durationHours;

    const hour = startDate.getHours();
    eventsByHour[hour] = (eventsByHour[hour] || 0) + 1;

    if (
      event.calendarId &&
      categories.some((cat) => cat.id === event.calendarId)
    ) {
      result.categorizedHours[event.calendarId] += durationHours;
      return;
    }

    let categorized = false;
    for (const category of categories) {
      const matchesKeyword = category.keywords.some(
        (keyword) =>
          event.title.toLowerCase().includes(keyword.toLowerCase()) ||
          (event.description &&
            event.description.toLowerCase().includes(keyword.toLowerCase())),
      );

      if (matchesKeyword) {
        result.categorizedHours[category.id] += durationHours;
        categorized = true;
        break;
      }
    }

    if (!categorized) {
      result.categorizedHours["uncategorized"] += durationHours;
    }
  });

  let maxHours = 0;
  for (const [day, hours] of Object.entries(eventsByDay)) {
    if (hours > maxHours) {
      maxHours = hours;
      result.mostProductiveDay = day;
    }
  }

  let maxEvents = 0;
  for (const [hour, count] of Object.entries(eventsByHour)) {
    if (count > maxEvents) {
      maxEvents = count;
      result.mostProductiveHour = Number.parseInt(hour);
    }
  }

  result.activeDays = Object.keys(eventsByDay).length;
  result.averageEventDuration =
    result.totalEvents > 0 ? result.totalHours / result.totalEvents : 0;

  let busiestCategoryId = "uncategorized";
  let busiestHours = -1;
  for (const [categoryId, hours] of Object.entries(result.categorizedHours)) {
    if (hours > busiestHours) {
      busiestHours = hours;
      busiestCategoryId = categoryId;
    }
  }
  result.busiestCategoryId = busiestCategoryId;

  return result;
}
