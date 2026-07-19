export const EVENT_BG_TO_ACCENT: Record<string, string> = {
  'bg-[#E6F6FD]': '#3B82F6',
  'bg-[#E7F8F2]': '#10B981',
  'bg-[#FEF5E6]': '#F59E0B',
  'bg-[#FFE4E6]': '#EF4444',
  'bg-[#F3EEFE]': '#8B5CF6',
  'bg-[#FCE7F3]': '#EC4899',
  'bg-[#EEF2FF]': '#6366F1',
  'bg-[#FFF0E5]': '#FB923C',
  'bg-[#E6FAF7]': '#14B8A6',
}

export const EVENT_BG_TO_DARK: Record<string, string> = {
  'bg-[#E6F6FD]': '#2F4655',
  'bg-[#E7F8F2]': '#2D4935',
  'bg-[#FEF5E6]': '#4F3F1B',
  'bg-[#FFE4E6]': '#6C2920',
  'bg-[#F3EEFE]': '#483A63',
  'bg-[#FCE7F3]': '#5A334A',
  'bg-[#E6FAF7]': '#1F4A47',
}

export const DEFAULT_ACCENT = '#3A3A3A'

export const TAILWIND_BG_TO_HEX: Record<string, string> = {
  'bg-blue-500': '#3b82f6',
  'bg-green-500': '#10b981',
  'bg-yellow-500': '#f59e0b',
  'bg-red-500': '#ef4444',
  'bg-purple-500': '#8b5cf6',
  'bg-pink-500': '#ec4899',
  'bg-teal-500': '#14b8a6',
  'bg-[#E6F6FD]': '#3B82F6',
  'bg-[#E7F8F2]': '#10B981',
  'bg-[#FEF5E6]': '#F59E0B',
  'bg-[#FFE4E6]': '#EF4444',
  'bg-[#F3EEFE]': '#8B5CF6',
  'bg-[#FCE7F3]': '#EC4899',
  'bg-[#EEF2FF]': '#6366F1',
  'bg-[#FFF0E5]': '#FB923C',
  'bg-[#E6FAF7]': '#14B8A6',
}

export const CHART_COLOR_ORDER = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
]

export interface ColorOption {
  value: string
  labelKey: 'colorBlue' | 'colorGreen' | 'colorAmber' | 'colorRed' | 'colorPurple' | 'colorPink' | 'colorTeal'
  calendarColor: string
}

export const EVENT_COLOR_OPTIONS: ColorOption[] = [
  { value: 'bg-[#E6F6FD]', labelKey: 'colorBlue', calendarColor: 'bg-blue-500' },
  { value: 'bg-[#E7F8F2]', labelKey: 'colorGreen', calendarColor: 'bg-green-500' },
  { value: 'bg-[#FEF5E6]', labelKey: 'colorAmber', calendarColor: 'bg-yellow-500' },
  { value: 'bg-[#FFE4E6]', labelKey: 'colorRed', calendarColor: 'bg-red-500' },
  { value: 'bg-[#F3EEFE]', labelKey: 'colorPurple', calendarColor: 'bg-purple-500' },
  { value: 'bg-[#FCE7F3]', labelKey: 'colorPink', calendarColor: 'bg-pink-500' },
  { value: 'bg-[#E6FAF7]', labelKey: 'colorTeal', calendarColor: 'bg-teal-500' },
]

export const CALENDAR_COLOR_TO_EVENT_COLOR = Object.fromEntries(
  EVENT_COLOR_OPTIONS.map((opt) => [opt.calendarColor, opt.value]),
)

export function getEventAccentColor(color?: string): string {
  if (!color) return DEFAULT_ACCENT
  return EVENT_BG_TO_ACCENT[color] ?? DEFAULT_ACCENT
}

export function getEventBackgroundColor(color: string | undefined, isDark: boolean): string | undefined {
  if (!isDark || !color) return undefined
  return EVENT_BG_TO_DARK[color]
}
