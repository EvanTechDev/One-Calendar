/**
 * MCP colour vocabulary.
 *
 * Both lists are DERIVED from {@link EVENT_COLORS} in `lib/event-colors.ts`,
 * which is the single place a colour is defined. They used to be hand-written
 * here and had already drifted from the UI: the event list held 7 entries for 9
 * storable colours, so `indigo` and `orange` — both accepted by
 * `POST /api/events` and by the agent tools — were not in the MCP schema, and
 * three palette hexes resolved to a different colour than the swatch a user
 * would pick for the same name.
 *
 * The ORDER of both lists is load-bearing, not cosmetic: it is interpolated into
 * the tool descriptions and enum schemas in `lib/mcp/server.ts`, so reordering
 * changes what an MCP client sees.
 */

import {
  EVENT_COLORS,
  PALETTE_COLOR_OPTIONS,
  paletteColorName,
} from '@/lib/event-colors'

/**
 * Event colours, in menu order — the same seven the event colour menu offers.
 * The MCP name is not derivable from the palette class: the `#FEF5E6` background
 * is stored against `bg-yellow-500` but is called "amber" here, because that is
 * what a client asking for amber expects.
 *
 * Indigo and orange are filtered out with the rest of the non-selectable
 * colours. They remain accepted on input (an older file or an existing event
 * can still carry one), so `normalizeColor` still resolves them; they are just
 * not on offer.
 */
export const COLOR_OPTIONS = EVENT_COLORS.filter(
  (c) => c.selectable !== false,
).map((c) => ({
  name: c.mcpName,
  value: c.value,
  hex: c.accent,
}))

export const COLOR_NAMES = COLOR_OPTIONS.map((c) => c.name)

export const COLOR_NAME_LIST = COLOR_NAMES.join(', ')

export const COLOR_HEX_VALUES = COLOR_OPTIONS.map((c) => c.hex)

export const COLOR_HEX_LIST = COLOR_HEX_VALUES.join(', ')

// Countdowns (and the UI palette) store Tailwind palette classes such as
// "bg-blue-500" instead of the light event-style backgrounds. Names and hex
// codes accepted by MCP are mapped to this palette.
//
// `PALETTE_COLOR_OPTIONS` orders the classes blue, green, yellow, amber, red,
// purple, pink, indigo, orange, teal — the same order this file listed them in.
const COUNTDOWN_COLOR_OPTIONS = PALETTE_COLOR_OPTIONS.map((c) => ({
  name: paletteColorName(c.value),
  value: c.value,
  hex: c.hex.toUpperCase(),
}))

export const COUNTDOWN_COLOR_NAMES = COUNTDOWN_COLOR_OPTIONS.map((c) => c.name)

export function normalizeColor(color: string): string {
  if (!color) return color
  const trimmed = color.trim()
  const byName = COLOR_OPTIONS.find((c) => c.name === trimmed)
  if (byName) return byName.value
  const byHex = COLOR_OPTIONS.find((c) => c.hex === trimmed.toUpperCase())
  if (byHex) return byHex.value
  const byValue = COLOR_OPTIONS.find((c) => c.value === trimmed)
  if (byValue) return byValue.value
  return trimmed
}

export function normalizeCountdownColor(color: string): string {
  if (!color) return color
  const trimmed = color.trim()
  const byName = COUNTDOWN_COLOR_OPTIONS.find((c) => c.name === trimmed)
  if (byName) return byName.value
  const trimmedUpper = trimmed.toUpperCase()
  const byHex = COUNTDOWN_COLOR_OPTIONS.find(
    (c) => c.hex === trimmedUpper || c.hex === color,
  )
  if (byHex) return byHex.value
  const byPaletteValue = COUNTDOWN_COLOR_OPTIONS.find(
    (c) => c.value === trimmed,
  )
  if (byPaletteValue) return byPaletteValue.value
  // Names/hexes from the event palette map to the same base Tailwind color.
  const byEventColor = COLOR_OPTIONS.find(
    (c) => c.name === trimmed || c.hex === trimmedUpper || c.value === trimmed,
  )
  if (byEventColor) {
    const palette = COUNTDOWN_COLOR_OPTIONS.find(
      (c) => c.name === byEventColor.name || c.hex === byEventColor.hex,
    )
    if (palette) return palette.value
  }
  return trimmed
}
