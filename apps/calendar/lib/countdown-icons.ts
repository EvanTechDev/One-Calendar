/**
 * Countdown icon catalogue — the single source of truth shared by the picker UI
 * and the MCP tool schema.
 *
 * Dependency-free on purpose: the MCP server validates against this list, and
 * importing `lucide-react` (which the picker needs to render glyphs) would drag
 * the whole icon library into the server bundle. Availability against lucide is
 * therefore checked on the client side instead.
 */

export interface CountdownIconGroup {
  /** Stable key, also used as the i18n lookup for the section label. */
  id: string
  label: string
  icons: string[]
}

export const COUNTDOWN_ICON_GROUPS: CountdownIconGroup[] = [
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

export const COUNTDOWN_ICON_NAMES: string[] = COUNTDOWN_ICON_GROUPS.flatMap(
  (group) => group.icons,
)

export const DEFAULT_COUNTDOWN_ICON = 'Clock'

/**
 * Non-empty tuple form required by `z.enum`. Cast is safe because the catalogue
 * above is a non-empty literal list.
 */
export const COUNTDOWN_ICON_ENUM = COUNTDOWN_ICON_NAMES as [string, ...string[]]

export function isCountdownIconName(name: string): boolean {
  return COUNTDOWN_ICON_NAMES.includes(name)
}
