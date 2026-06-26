export interface AnalyticsEvent {
  id: string
  start: Date
  end: Date
  category: string
  color: string
  createdAt: Date
}

export interface DateRange {
  start: Date
  end: Date
}
