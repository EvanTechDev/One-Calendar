interface CalendarEvent {
  id: string
  title: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  location?: string
  participants: string[]
  notification: number
  description?: string
  color: string
}
