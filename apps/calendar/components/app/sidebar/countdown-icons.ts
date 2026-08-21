import * as lucideIcons from 'lucide-react'

/**
 * Icons offered for countdowns, grouped by occasion.
 *
 * The picker used to list every lucide export (~1500 names) sorted
 * alphabetically and truncated to the first 200, so the visible set was an
 * arbitrary slice starting at "A" — mostly icons nobody would pick for a
 * countdown. Grouping also gives the picker real section headers instead of one
 * undifferentiated grid.
 */
export interface CountdownIconGroup {
  /** Stable key, also used as the i18n lookup for the section label. */
  id: string
  label: string
  icons: string[]
}

const RAW_GROUPS: CountdownIconGroup[] = [
  {
    id: 'time',
    label: 'Time',
    icons: [
      'Clock',
      'AlarmClock',
      'AlarmClockCheck',
      'Timer',
      'Hourglass',
      'CalendarDays',
      'CalendarClock',
      'CalendarCheck',
      'CalendarHeart',
      'History',
    ],
  },
  {
    id: 'celebration',
    label: 'Celebration',
    icons: [
      'PartyPopper',
      'Cake',
      'Gift',
      'Sparkles',
      'Star',
      'Heart',
      'Crown',
      'Trophy',
      'Medal',
      'Award',
      'Confetti',
      'Bell',
    ],
  },
  {
    id: 'travel',
    label: 'Travel',
    icons: [
      'Plane',
      'PlaneTakeoff',
      'PlaneLanding',
      'Train',
      'TramFront',
      'Car',
      'Bus',
      'Ship',
      'Bike',
      'Luggage',
      'MapPin',
      'Map',
      'Globe',
      'Compass',
      'Tent',
      'Palmtree',
      'Mountain',
      'Umbrella',
      'Sun',
      'Waves',
    ],
  },
  {
    id: 'work',
    label: 'Work & study',
    icons: [
      'Briefcase',
      'GraduationCap',
      'BookOpen',
      'Notebook',
      'PenLine',
      'Presentation',
      'Target',
      'Rocket',
      'Building2',
      'Users',
      'Handshake',
      'FileText',
      'ClipboardCheck',
      'ChartLine',
      'Code',
      'Laptop',
    ],
  },
  {
    id: 'life',
    label: 'Milestones',
    icons: [
      'Baby',
      'Home',
      'HeartHandshake',
      'Stethoscope',
      'Pill',
      'HeartPulse',
      'Dumbbell',
      'Footprints',
      'Sprout',
      'Key',
    ],
  },
  {
    id: 'seasons',
    label: 'Seasons',
    icons: [
      'Snowflake',
      'TreePine',
      'Flower2',
      'Leaf',
      'Moon',
      'CloudSun',
      'CloudRain',
      'Flame',
      'Ghost',
      'Egg',
      'Rainbow',
    ],
  },
  {
    id: 'money',
    label: 'Money',
    icons: [
      'Wallet',
      'CreditCard',
      'PiggyBank',
      'ShoppingCart',
      'ShoppingBag',
      'Tag',
      'Receipt',
      'Coins',
      'BadgeDollarSign',
    ],
  },
  {
    id: 'leisure',
    label: 'Leisure',
    icons: [
      'Music',
      'Film',
      'Tv',
      'Gamepad2',
      'Ticket',
      'Camera',
      'Mic',
      'Popcorn',
      'Wine',
      'Coffee',
      'UtensilsCrossed',
      'Pizza',
      'Dices',
      'Guitar',
    ],
  },
  {
    id: 'other',
    label: 'Other',
    icons: [
      'Flag',
      'Bookmark',
      'Zap',
      'Lightbulb',
      'Package',
      'Wrench',
      'Palette',
      'Puzzle',
      'Anchor',
      'Shield',
      'Smile',
      'ThumbsUp',
      'CircleCheck',
      'Info',
    ],
  },
]

/** True when lucide actually exports this icon. */
export function isLucideIconName(name: string): boolean {
  return name in lucideIcons
}

/**
 * Groups with unavailable icons filtered out, so a lucide rename shows a
 * shorter list rather than blank cells.
 */
export const COUNTDOWN_ICON_GROUPS: CountdownIconGroup[] = RAW_GROUPS.map(
  (group) => ({ ...group, icons: group.icons.filter(isLucideIconName) }),
).filter((group) => group.icons.length > 0)

export const COUNTDOWN_ICON_NAMES: string[] = COUNTDOWN_ICON_GROUPS.flatMap(
  (group) => group.icons,
)

export const DEFAULT_COUNTDOWN_ICON = 'Clock'

/**
 * Searches the curated set first and only falls back to the full lucide
 * catalogue when nothing matches, so a deliberate search for an uncommon icon
 * still works without the catalogue drowning the default view.
 */
export function searchCountdownIcons(keyword: string, limit = 60): string[] {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return COUNTDOWN_ICON_NAMES
  const curated = COUNTDOWN_ICON_NAMES.filter((name) =>
    name.toLowerCase().includes(needle),
  )
  if (curated.length > 0) return curated
  return Object.keys(lucideIcons)
    .filter(
      (name) =>
        /^[A-Z]/.test(name) &&
        !name.endsWith('Icon') &&
        name.toLowerCase().includes(needle),
    )
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit)
}
