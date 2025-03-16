import { createEvents, type EventAttributes } from "ics"

interface Event {
  id: string
  title: string
  date: Date
  description?: string
}

export function exportToICS(events: Event[]) {
  const icsEvents: EventAttributes[] = events.map((event) => {
    // 获取事件的日期
    const startDate = new Date(event.date)

    // 计算结束时间（默认为1小时后）
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)

    // 转换为UTC时间数组格式 [year, month, day, hour, minute]
    const start = [
      startDate.getUTCFullYear(),
      startDate.getUTCMonth() + 1, // ics库需要1-12的月份
      startDate.getUTCDate(),
      startDate.getUTCHours(),
      startDate.getUTCMinutes(),
    ]

    // 计算持续时间（小时和分钟）
    const durationHours = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60))
    const durationMinutes = Math.floor(((endDate.getTime() - startDate.getTime()) % (1000 * 60 * 60)) / (1000 * 60))

    return {
      title: event.title,
      description: event.description,
      start: start,
      duration: { hours: durationHours, minutes: durationMinutes },
    }
  })

  createEvents(icsEvents, (error, value) => {
    if (error) {
      console.log(error)
      return
    }

    const blob = new Blob([value], { type: "text/calendar;charset=utf-8" })
    const link = document.createElement("a")
    link.href = window.URL.createObjectURL(blob)
    link.setAttribute("download", "calendar.ics")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  })
}

export async function importFromICS(file: File): Promise<Event[]> {
  const text = await file.text()
  const lines = text.split("\n")
  const events: Event[] = []
  let currentEvent: Partial<Event> = {}

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      currentEvent = {}
    } else if (line.startsWith("END:VEVENT")) {
      if (currentEvent.title && currentEvent.date) {
        events.push(currentEvent as Event)
      }
      currentEvent = {}
    } else if (line.startsWith("SUMMARY:")) {
      currentEvent.title = line.slice(8)
    } else if (line.startsWith("DTSTART:")) {
      const dateString = line.slice(8)
      // 处理UTC时间格式 (YYYYMMDDTHHMMSSZ)
      if (dateString.endsWith("Z")) {
        const year = Number.parseInt(dateString.slice(0, 4), 10)
        const month = Number.parseInt(dateString.slice(4, 6), 10) - 1 // JavaScript月份从0开始
        const day = Number.parseInt(dateString.slice(6, 8), 10)
        const hour = Number.parseInt(dateString.slice(9, 11), 10)
        const minute = Number.parseInt(dateString.slice(11, 13), 10)
        const second = Number.parseInt(dateString.slice(13, 15), 10)

        // 创建UTC日期并转换为本地时间
        currentEvent.date = new Date(Date.UTC(year, month, day, hour, minute, second))
      } else {
        // 处理本地时间格式 (YYYYMMDDTHHMMSS)
        currentEvent.date = new Date(
          Number.parseInt(dateString.slice(0, 4), 10),
          Number.parseInt(dateString.slice(4, 6), 10) - 1,
          Number.parseInt(dateString.slice(6, 8), 10),
          Number.parseInt(dateString.slice(9, 11), 10),
          Number.parseInt(dateString.slice(11, 13), 10),
          Number.parseInt(dateString.slice(13, 15), 10),
        )
      }
    } else if (line.startsWith("DESCRIPTION:")) {
      currentEvent.description = line.slice(12)
    }
  }

  return events
}

