/**

 * The one place an event colour is defined.
 *
 * Every map this module exports — accents, dark backgrounds, the Tailwind
 * palette classes, the MCP normalisers, the chart order — is DERIVED from
 * {@link EVENT_COLORS}. That table used to be duplicated across
 * `lib/event-colors.ts`, `lib/mcp/colors.ts`, `lib/mcp/event-tools.ts`,
 * `views/year-view.tsx`, `event/event-preview.tsx`, `sidebar/sidebar.tsx` and
 * `sidebar/bookmark-panel.tsx`, and the copies had already diverged in ways
 * that reached the screen:
 *
 * - `EVENT_BG_TO_DARK` had 7 entries for 9 storable colours, so an event the
 *   API or MCP could create (`bg-[#EEF2FF]`, `bg-[#FFF0E5]`) rendered with its
 *   near-white light background in dark mode, and `getEventBackgroundColor`
 *   returned `undefined` for it.
 * - `EVENT_COLOR_OPTIONS` also had 7, and 7 is CORRECT. The product's event
 *   palette is seven colours and countdown, category, event and MCP all agree
 *   on that. `bg-[#EEF2FF]` and `bg-[#FFF0E5]` are storable but not offered,
 *   so they are marked `selectable: false`: an event arriving wearing one from
 *   an older file or an external client still needs an accent and a dark
 *   background to render with, which is why they stay in this table at all —
 *   but they are not on sale. Widening the picker to nine was wrong, not a fix.
 * - The palette classes resolved to two different hexes for the same colour:
 *   `bg-green-500` was `#10b981` (emerald-500's hex) here and `#22c55e` in
 *   `lib/mcp/colors.ts`, `bg-yellow-500` was `#f59e0b` (amber-500's) and
 *   `bg-purple-500` was `#8b5cf6` (violet-500's). A category dot painted by
 *   Tailwind and its chart segment painted from these tables therefore
 *   disagreed on the same colour.
 *
 * Hexes are UPPERCASE because `lib/mcp/colors.ts` matches an MCP client's hex
 * against them case-sensitively in one arm of its comparison.
 *
 * They are Tailwind v3's values, which is what this file and `lib/mcp/colors.ts`
 * already assumed. Tailwind v4 defines these as oklch and is a little more
 * saturated, so a hex here is very slightly off what a `bg-*-500` swatch
 * actually paints; correcting that is a re-theming decision rather than a bug
 * fix, and it would repaint every existing chart.
 */

export type ColorLabelKey =
  | 'colorBlue'
  | 'colorGreen'
  | 'colorAmber'
  | 'colorYellow'
  | 'colorRed'
  | 'colorPurple'
  | 'colorPink'
  | 'colorTeal'
  | 'colorIndigo'
  | 'colorOrange'

export interface EventColor {
  /** The class an event row stores, and the only form the API accepts. */
  value: string
  /** Text / accent colour drawn on top of `value` in light mode. */
  accent: string
  /**
   * Dark-mode background. Every colour in this table must have one: an event
   * stored with a colour that resolves to `undefined` here falls back to its
   * light background, which is a near-white block on a dark page.
   */
  dark: string
  /** The Tailwind palette class a category or countdown of this hue uses. */
  calendarColor: string
  /** The hex `calendarColor` paints. */
  calendarHex: string
  /**
   * The short name MCP clients use for this colour. Not derivable from
   * `calendarColor`: the amber event background is stored as the
   * `bg-yellow-500` palette class, but an MCP client that says "amber" has to
   * mean it.
   */
  mcpName: string
  /** Label in the EVENT colour menu. */
  labelKey: ColorLabelKey
  /**
   * Whether the event colour menu offers this swatch.
   *
   * `false` for indigo and orange. The product's event palette is seven
   * colours and has always been seven — adding two more to the picker was a
   * wrong call, not a fix. They stay in this table because the API and MCP
   * still accept them (`lib/validation.ts` `colorRegex`, `PALETTE_TO_EVENT_COLOR`),
   * so an event can and does arrive wearing one from an older file or an
   * external client. What that needs is a background and an accent to render
   * with, which `accent` and `dark` provide; it does not need to be on sale.
   *
   * So: excluded from `EVENT_COLOR_OPTIONS` and from the MCP colour list, kept
   * in `EVENT_BG_TO_ACCENT`, `EVENT_BG_TO_DARK` and `CHART_COLOR_ORDER`.
   */
  selectable?: false
  /**
   * Label in the category / countdown palette menu. Separate from
   * `labelKey` because the app genuinely names this hue two ways: the event
   * swatch reads "Amber" (`colorAmber`) while `bg-yellow-500` in the palette
   * reads "Yellow" (`colorYellow`), with `bg-amber-500` offered beside it as
   * the alias. Collapsing the two would rename one of the menus.
   */
  paletteLabelKey: ColorLabelKey
}

/**
 * Ordered so that the palette classes, read in order and with the amber alias
 * spliced in after yellow, reproduce the category/countdown colour menu exactly
 * as it was: blue, green, yellow, amber, red, purple, pink, indigo, orange,
 * teal. Teal stays last in `CHART_COLOR_ORDER` for the same reason it did.
 */
export const EVENT_COLORS: EventColor[] = [
  {
    value: 'bg-[#E6F6FD]',
    accent: '#3B82F6',
    dark: '#2F4655',
    calendarColor: 'bg-blue-500',
    calendarHex: '#3B82F6',
    mcpName: 'blue',
    labelKey: 'colorBlue',
    paletteLabelKey: 'colorBlue',
  },
  {
    value: 'bg-[#E7F8F2]',
    accent: '#10B981',
    dark: '#2D4935',
    calendarColor: 'bg-green-500',
    calendarHex: '#22C55E',
    mcpName: 'green',
    labelKey: 'colorGreen',
    paletteLabelKey: 'colorGreen',
  },
  {
    value: 'bg-[#FEF5E6]',
    accent: '#F59E0B',
    dark: '#4F3F1B',
    calendarColor: 'bg-yellow-500',
    calendarHex: '#EAB308',
    mcpName: 'amber',
    labelKey: 'colorAmber',
    paletteLabelKey: 'colorYellow',
  },
  {
    value: 'bg-[#FFE4E6]',
    accent: '#EF4444',
    dark: '#6C2920',
    calendarColor: 'bg-red-500',
    calendarHex: '#EF4444',
    mcpName: 'red',
    labelKey: 'colorRed',
    paletteLabelKey: 'colorRed',
  },
  {
    value: 'bg-[#F3EEFE]',
    accent: '#8B5CF6',
    dark: '#483A63',
    calendarColor: 'bg-purple-500',
    calendarHex: '#A855F7',
    mcpName: 'purple',
    labelKey: 'colorPurple',
    paletteLabelKey: 'colorPurple',
  },
  {
    value: 'bg-[#FCE7F3]',
    accent: '#EC4899',
    dark: '#5A334A',
    calendarColor: 'bg-pink-500',
    calendarHex: '#EC4899',
    mcpName: 'pink',
    labelKey: 'colorPink',
    paletteLabelKey: 'colorPink',
  },
  {
    value: 'bg-[#EEF2FF]',
    accent: '#6366F1',
    dark: '#2A3053',
    calendarColor: 'bg-indigo-500',
    calendarHex: '#6366F1',
    mcpName: 'indigo',
    labelKey: 'colorIndigo',
    selectable: false,
    paletteLabelKey: 'colorIndigo',
  },
  {
    value: 'bg-[#FFF0E5]',
    accent: '#FB923C',
    dark: '#54371E',
    calendarColor: 'bg-orange-500',
    calendarHex: '#F97316',
    mcpName: 'orange',
    labelKey: 'colorOrange',
    selectable: false,
    paletteLabelKey: 'colorOrange',
  },
  {
    value: 'bg-[#E6FAF7]',
    accent: '#14B8A6',
    dark: '#1F4A47',
    calendarColor: 'bg-teal-500',
    calendarHex: '#14B8A6',
    mcpName: 'teal',
    labelKey: 'colorTeal',
    paletteLabelKey: 'colorTeal',
  },
]

/**
 * The colour name inside a Tailwind palette class. Every palette class in this
 * module is `bg-<name>-500`, which is what Tailwind's scale guarantees, so this
 * is the inverse of the class rather than a lookup — and it is how an MCP
 * client saying "indigo" is matched to `bg-indigo-500`.
 */
export function paletteColorName(paletteClass: string): string {
  return paletteClass.replace(/^bg-/, '').replace(/-500$/, '')
}

/**
 * Palette classes that are not any colour's primary `calendarColor` but name the
 * same hue, so a category created with one still resolves. Both the countdown
 * and `normalizeCountdownColor`/`PALETTE_TO_EVENT_COLOR` can resolve one if a
 * client sends it. It is not offered in any picker.
 */
const CALENDAR_COLOR_ALIASES: Record<string, string> = {
  'bg-amber-500': 'bg-[#FEF5E6]',
}

export const DEFAULT_ACCENT = '#3A3A3A'

export const EVENT_BG_TO_ACCENT: Record<string, string> = Object.fromEntries(
  EVENT_COLORS.map((c) => [c.value, c.accent]),
)

export const EVENT_BG_TO_DARK: Record<string, string> = Object.fromEntries(
  EVENT_COLORS.map((c) => [c.value, c.dark]),
)

/**
 * Every colour class the app stores, as a hex. Both kinds resolve through here:
 * event backgrounds (to their accent, which is what tints a chart segment) and
 * the Tailwind palette classes categories and countdowns use (to the hex that
 * class paints).
 */
export const TAILWIND_BG_TO_HEX: Record<string, string> = {
  ...EVENT_BG_TO_ACCENT,
  ...Object.fromEntries(
    EVENT_COLORS.map((c) => [c.calendarColor, c.calendarHex]),
  ),
  ...Object.fromEntries(
    Object.entries(CALENDAR_COLOR_ALIASES).map(([palette, eventValue]) => [
      palette,
      EVENT_BG_TO_ACCENT[eventValue] ?? DEFAULT_ACCENT,
    ]),
  ),
}

export const CHART_COLOR_ORDER = EVENT_COLORS.map((c) => c.accent.toLowerCase())

export interface ColorOption {
  value: string
  labelKey: ColorLabelKey
  calendarColor: string
}

/**
 * The seven event swatches, in menu order.
 *
 * Derived from `EVENT_COLORS` and filtered by `selectable`, rather than typed
 * out, so the two cannot drift. Indigo and orange are in the table for
 * rendering events that arrive wearing them; they are not offered for
 * choosing.
 */
export const EVENT_COLOR_OPTIONS: ColorOption[] = EVENT_COLORS.filter(
  (c) => c.selectable !== false,
).map((c) => ({
  value: c.value,
  labelKey: c.labelKey,
  calendarColor: c.calendarColor,
}))

/**
 * The category / countdown palette: seven Tailwind palette classes.
 *
 * Written out rather than derived from `EVENT_COLORS`, deliberately. The two
 * lists are not the same list. This one is Tailwind classes (`bg-blue-500`),
 * in an order the product has always presented them, and it is seven — blue,
 * green, yellow, red, purple, pink, teal. Deriving it produced ten swatches
 * once `EVENT_COLORS` grew an amber alias and two extra hues, which is not a
 * palette anyone had agreed to. The event menu is derived from the table
 * because it IS the table; this menu is its own thing.
 *
 * The hexes still come from `TAILWIND_BG_TO_HEX`, so a class resolves to one
 * value everywhere rather than to whichever table the code path used.
 */
export const PALETTE_COLOR_OPTIONS: Array<{
  value: string
  hex: string
  labelKey: ColorLabelKey
}> = (
  [
    ['bg-blue-500', 'colorBlue'],
    ['bg-green-500', 'colorGreen'],
    ['bg-yellow-500', 'colorYellow'],
    ['bg-red-500', 'colorRed'],
    ['bg-purple-500', 'colorPurple'],
    ['bg-pink-500', 'colorPink'],
    ['bg-teal-500', 'colorTeal'],
  ] as const
).map(([value, labelKey]) => ({
  value,
  hex: TAILWIND_BG_TO_HEX[value] ?? DEFAULT_ACCENT,
  labelKey,
}))

/** Every colour class an event row can store. Shared with the MCP tools. */
export const EVENT_COLOR_VALUES = new Set(EVENT_COLORS.map((c) => c.value))

/** Palette class → the event background a category of that colour maps to. */
export const CALENDAR_COLOR_TO_EVENT_COLOR: Record<string, string> = {
  ...Object.fromEntries(EVENT_COLORS.map((c) => [c.calendarColor, c.value])),
  ...CALENDAR_COLOR_ALIASES,
}

/**
 * Alias of {@link CALENDAR_COLOR_TO_EVENT_COLOR}, named for its MCP call site.
 * An MCP client may pass `bg-amber-500` where the UI would pass `bg-yellow-500`;
 * both have to land on the same stored background.
 */
export const PALETTE_TO_EVENT_COLOR = CALENDAR_COLOR_TO_EVENT_COLOR

export function getEventAccentColor(color?: string): string {
  if (!color) return DEFAULT_ACCENT
  return EVENT_BG_TO_ACCENT[color] ?? DEFAULT_ACCENT
}

export function getEventBackgroundColor(
  color: string | undefined,
  isDark: boolean,
): string | undefined {
  if (!isDark || !color) return undefined
  return EVENT_BG_TO_DARK[color]
}
