import { z } from 'zod'

// The calendar client stores colors as Tailwind classes, not raw hex:
// events use arbitrary values ("bg-[#E6F6FD]"), categories/countdowns use the
// palette ("bg-blue-500", "bg-indigo-500", ...). Raw hex is kept for other
// consumers (imports, MCP). Union of all three, nothing else.
const hexColor = '#[0-9a-fA-F]{6}'
const paletteColor =
  'bg-(blue|green|yellow|red|purple|pink|teal|indigo|orange)-500'

export const colorRegex = new RegExp(
  `^(?:${hexColor}|${paletteColor}|bg-\\[${hexColor}\\])$`,
)

export const dateTimeString = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime())

// Countdowns POST targetDate as "YYYY-MM-DD" (no time component).
export const dateOnlyString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const eventSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  location: z.string().max(500).nullish(),
  startDate: dateTimeString,
  endDate: dateTimeString,
  isAllDay: z.boolean().optional(),
  color: z.string().regex(colorRegex).nullish(),
  categoryId: z.string().nullish(),
  participants: z
    .array(
      z.object({
        name: z.string().max(100),
        email: z.string().email().nullish(),
        userId: z.string().nullish(),
      }),
    )
    .max(50)
    .nullish(),
  notificationMinutes: z.number().int().min(0).max(10080).nullish(),
})

export const categorySchema = z.object({
  id: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(50),
  color: z.string().regex(colorRegex),
  sortOrder: z.number().int().min(0).max(10000).optional(),
})

export const countdownSchema = z.object({
  id: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100),
  targetDate: dateTimeString.or(dateOnlyString),
  repeat: z.string().max(20).optional(),
  description: z.string().max(1000).nullish(),
  color: z.string().regex(colorRegex).nullish(),
  icon: z.string().max(50).nullish(),
})

export const importSchema = z.object({
  events: z.array(eventSchema).max(500).optional(),
  categories: z.array(categorySchema).max(200).optional(),
  countdowns: z.array(countdownSchema).max(200).optional(),
  bookmarks: z.array(z.object({ eventId: z.string() })).max(500).optional(),
  settings: z
    .record(z.string(), z.unknown())
    .refine((value) => Object.keys(value).length <= 256, {
      message: 'Too many settings keys',
    })
    .optional(),
})

export const bookmarkSchema = z.object({
  id: z.string().uuid().optional(),
  eventId: z.string(),
})

export function firstZodMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues: Array<{ message: string }> }).issues
    return issues[0]?.message ?? 'Invalid input'
  }
  return 'Invalid input'
}