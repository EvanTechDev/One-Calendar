export interface TimeCategory {
  id: string
  name: string
  color: string
  keywords: string[]
}

export interface TimeAnalytics {
  totalEvents: number
  totalHours: number
  categorizedHours: Record<string, number>
  mostProductiveDay: string
  mostProductiveHour: number
  longestEvent: {
    title: string
    duration: number
  }
}

export const defaultTimeCategories: TimeCategory[] = [
  {
    id: "work",
    name: "工作",
    color: "bg-blue-500",
    keywords: ["会议", "工作", "项目", "讨论", "meeting", "work", "project"],
  },
  {
    id: "personal",
    name: "个人",
    color: "bg-green-500",
    keywords: ["健身", "锻炼", "休息", "娱乐", "personal", "gym", "workout", "rest"],
  },
  {
    id: "learning",
    name: "学习",
    color: "bg-purple-500",
    keywords: ["学习", "课程", "培训", "研讨会", "study", "course", "training"],
  },
  {
    id: "social",
    name: "社交",
    color: "bg-yellow-500",
    keywords: ["聚会", "约会", "朋友", "家人", "party", "date", "friends", "family"],
  },
  {
    id: "health",
    name: "健康",
    color: "bg-red-500",
    keywords: ["医生", "医院", "检查", "doctor", "hospital", "checkup", "health"],
  },
]

export function analyzeTimeUsage(events: any[], categories: TimeCategory[] = defaultTimeCategories): TimeAnalytics {
  // 初始化结果
  const result: TimeAnalytics = {
    totalEvents: events.length,
    totalHours: 0,
    categorizedHours: {},
    mostProductiveDay: "",
    mostProductiveHour: 0,
    longestEvent: {
      title: "",
      duration: 0,
    },
  }

  // 初始化分类时间
  categories.forEach((category) => {
    result.categorizedHours[category.id] = 0
  })
  result.categorizedHours["uncategorized"] = 0

  // 按天和小时统计事件
  const eventsByDay: Record<string, number> = {}
  const eventsByHour: Record<number, number> = {}
  for (let i = 0; i < 24; i++) {
    eventsByHour[i] = 0
  }

  // 分析每个事件
  events.forEach((event) => {
    const startDate = new Date(event.startDate)
    const endDate = new Date(event.endDate)
    const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)

    // 更新总时间
    result.totalHours += durationHours

    // 更新最长事件
    if (durationHours > result.longestEvent.duration) {
      result.longestEvent = {
        title: event.title,
        duration: durationHours,
      }
    }

    // 按天统计
    const dayKey = startDate.toISOString().split("T")[0]
    eventsByDay[dayKey] = (eventsByDay[dayKey] || 0) + durationHours

    // 按小时统计
    const hour = startDate.getHours()
    eventsByHour[hour] = (eventsByHour[hour] || 0) + 1

    // 首先检查事件是否有calendarId，如果有，直接使用该分类
    if (event.calendarId && categories.some((cat) => cat.id === event.calendarId)) {
      result.categorizedHours[event.calendarId] += durationHours
      return // 已分类，跳过关键词匹配
    }

    // 如果没有calendarId或calendarId不在分类列表中，尝试通过关键词匹配
    let categorized = false
    for (const category of categories) {
      const matchesKeyword = category.keywords.some(
        (keyword) =>
          event.title.toLowerCase().includes(keyword.toLowerCase()) ||
          (event.description && event.description.toLowerCase().includes(keyword.toLowerCase())),
      )

      if (matchesKeyword) {
        result.categorizedHours[category.id] += durationHours
        categorized = true
        break
      }
    }

    if (!categorized) {
      result.categorizedHours["uncategorized"] += durationHours
    }
  })

  // 找出最高效的日子
  let maxHours = 0
  for (const [day, hours] of Object.entries(eventsByDay)) {
    if (hours > maxHours) {
      maxHours = hours
      result.mostProductiveDay = day
    }
  }

  // 找出最高效的小时
  let maxEvents = 0
  for (const [hour, count] of Object.entries(eventsByHour)) {
    if (count > maxEvents) {
      maxEvents = count
      result.mostProductiveHour = Number.parseInt(hour)
    }
  }

  return result
}
