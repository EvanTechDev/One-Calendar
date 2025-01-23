import { createEvents, type EventAttributes } from "ics"

interface Event {
  id: string
  title: string
  date: Date
  description?: string
}

export function exportToICS(events: Event[]) {
  const icsEvents: EventAttributes[] = events.map((event) => ({
    title: event.title,
    description: event.description,
    start: [
      event.date.getFullYear(),
      event.date.getMonth() + 1,
      event.date.getDate(),
      event.date.getHours(),
      event.date.getMinutes(),
    ],
    duration: { hours: 1 },
  }))

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
      currentEvent.date = new Date(
        Number.parseInt(dateString.slice(0, 4)),
        Number.parseInt(dateString.slice(4, 6)) - 1,
        Number.parseInt(dateString.slice(6, 8)),
        Number.parseInt(dateString.slice(9, 11)),
        Number.parseInt(dateString.slice(11, 13)),
        Number.parseInt(dateString.slice(13, 15)),
      )
    } else if (line.startsWith("DESCRIPTION:")) {
      currentEvent.description = line.slice(12)
    }
  }

  return events
}

