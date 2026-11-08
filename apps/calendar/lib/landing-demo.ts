import type { CalendarEvent } from '@zntr/shared/calendar/lib/calendar-types'

// Fictional examples, explicitly labeled in the landing demo. Never read from
// or write to the account's event store, API, or browser storage.
export const DEMO_CATEGORIES = [
  { id: 'health', label: 'Health', color: 'bg-green-500' },
  { id: 'business', label: 'Business', color: 'bg-blue-500' },
  { id: 'people', label: 'People', color: 'bg-pink-500' },
] as const

export function landingDemoDate() {
  // Views accept a local wall-clock date; events below are UTC instants.
  return new Date(2026, 10, 2)
}

export function landingDemoEvents(): CalendarEvent[] {
  const examples = [
    [
      'design-critique',
      'Design sprint critique',
      2,
      9,
      60,
      'business',
      'bg-[#E6F6FD]',
    ],
    ['physio', 'Physiotherapy follow-up', 2, 11, 45, 'health', 'bg-[#E7F8F2]'],
    [
      'portfolio',
      'Portfolio review with Amelia',
      2,
      13,
      75,
      'people',
      'bg-[#FCE7F3]',
    ],
    [
      'invoicing',
      'Inbox zero and client invoicing',
      2,
      15,
      45,
      'business',
      'bg-[#FEF5E6]',
    ],
    ['breakfast', 'Running club breakfast', 3, 8, 45, 'health', 'bg-[#FEF5E6]'],
    [
      'launch-retro',
      'Launch retro with Northstar',
      3,
      10,
      75,
      'business',
      'bg-[#E6FAF7]',
    ],
    [
      'redlines',
      'Contract redlines due',
      3,
      13,
      45,
      'business',
      'bg-[#FFE4E6]',
    ],
    ['dinner-maya', 'Dinner with Maya', 3, 17, 90, 'people', 'bg-[#FCE7F3]'],
    ['strength', 'Strength training', 4, 8, 60, 'health', 'bg-[#E7F8F2]'],
    [
      'creative-audit',
      'Q1 creative direction audit',
      4,
      10,
      90,
      'business',
      'bg-[#F3EEFE]',
    ],
    ['dentist', 'Dental checkup', 4, 13, 45, 'health', 'bg-[#FFE4E6]'],
    [
      'career-jonas',
      'Career check-in with Jonas',
      4,
      15,
      60,
      'people',
      'bg-[#FEF5E6]',
    ],
    [
      'pipeline',
      'Go-to-market pipeline review',
      5,
      9,
      75,
      'business',
      'bg-[#E6F6FD]',
    ],
    [
      'lunch-priya',
      'Lunch with Priya at Meroe',
      5,
      12,
      60,
      'people',
      'bg-[#FEF5E6]',
    ],
    [
      'a11y-readout',
      'Accessibility audit readout',
      5,
      15,
      60,
      'business',
      'bg-[#E6FAF7]',
    ],
    [
      'cycle-planning',
      'Cycle 14 planning review',
      6,
      8,
      90,
      'business',
      'bg-[#EEF2FF]',
    ],
    ['lunch-jordan', 'Lunch with Jordan', 6, 12, 60, 'people', 'bg-[#FCE7F3]'],
    ['meal-prep', 'Weeknight meal prep', 6, 17, 60, 'health', 'bg-[#E7F8F2]'],
    ['long-run', 'Long run in Willow Park', 7, 9, 90, 'health', 'bg-[#E6FAF7]'],
    [
      'market',
      'Farmer’s market and record shop',
      7,
      13,
      90,
      'people',
      'bg-[#FEF5E6]',
    ],
    [
      'brunch',
      'Family brunch at Kaffeine',
      8,
      10,
      120,
      'people',
      'bg-[#FCE7F3]',
    ],
    [
      'reset',
      'Sunday reset and priorities',
      8,
      16,
      60,
      'health',
      'bg-[#E7F8F2]',
    ],
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
      description:
        'A fictional example event in the landing page’s sample schedule.',
      color,
      calendarId,
      viewOnly: true,
    }
  })
}
