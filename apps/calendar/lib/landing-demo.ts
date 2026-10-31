import type { CalendarEvent } from '@zntr/calendar/lib/calendar-types'

// Fictional examples, explicitly labeled in the landing demo. Never read from
// or write to the account's event store, API, or browser storage.
export const DEMO_CATEGORIES = [
  { id: 'work', label: 'Work', color: '#3B82F6' },
  { id: 'personal', label: 'Personal', color: '#8B5CF6' },
] as const

export function landingDemoDate() {
  // Views accept a local wall-clock date; events below are UTC instants.
  return new Date(2026, 10, 2)
}

export function landingDemoEvents(): CalendarEvent[] {
  const examples = [
    ['week-plan', 'Plan the week', 2, 9, 45, 'work', 'bg-[#E6F6FD]'],
    ['focus', 'Focus time', 2, 11, 90, 'work', 'bg-[#E6F6FD]'],
    ['design', 'Design review', 3, 10, 60, 'work', 'bg-[#E6F6FD]'],
    ['reading', 'Reading break', 3, 12, 45, 'personal', 'bg-[#F3EEFE]'],
    ['project', 'Project planning', 4, 9, 60, 'work', 'bg-[#E6F6FD]'],
    ['lunch', 'Lunch with a friend', 4, 12, 60, 'personal', 'bg-[#F3EEFE]'],
    ['writing', 'Writing time', 5, 10, 90, 'work', 'bg-[#E6F6FD]'],
    ['walk', 'Afternoon walk', 5, 13, 45, 'personal', 'bg-[#F3EEFE]'],
    ['review', 'Weekly review', 6, 11, 60, 'work', 'bg-[#E6F6FD]'],
    ['museum', 'Visit the museum', 7, 10, 120, 'personal', 'bg-[#F3EEFE]'],
    ['next-week', 'Plan next week', 8, 12, 45, 'personal', 'bg-[#F3EEFE]'],
  ] as const

  return examples.map(([id, title, day, hour, minutes, calendarId, color]) => {
    const startDate = new Date(Date.UTC(2026, 10, day, hour))
    return {
      id: `landing-${id}`,
      title,
      startDate,
      endDate: new Date(startDate.getTime() + minutes * 60_000),
      isAllDay: false,
      participants: [],
      notification: null,
      description: 'An example event in the landing page’s sample schedule.',
      color,
      calendarId,
      viewOnly: true,
    }
  })
}
