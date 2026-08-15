export const COLOR_OPTIONS = [
  { name: 'blue', value: 'bg-[#E6F6FD]', hex: '#3B82F6' },
  { name: 'green', value: 'bg-[#E7F8F2]', hex: '#10B981' },
  { name: 'amber', value: 'bg-[#FEF5E6]', hex: '#F59E0B' },
  { name: 'red', value: 'bg-[#FFE4E6]', hex: '#EF4444' },
  { name: 'purple', value: 'bg-[#F3EEFE]', hex: '#8B5CF6' },
  { name: 'pink', value: 'bg-[#FCE7F3]', hex: '#EC4899' },
  { name: 'teal', value: 'bg-[#E6FAF7]', hex: '#14B8A6' },
] as const

export const COLOR_NAMES = COLOR_OPTIONS.map((c) => c.name)

export const COLOR_NAME_LIST = COLOR_NAMES.join(', ')

export const COLOR_HEX_VALUES = COLOR_OPTIONS.map((c) => c.hex)

export const COLOR_HEX_LIST = COLOR_HEX_VALUES.join(', ')

// Countdowns (and the UI palette) store Tailwind palette classes such as
// "bg-blue-500" instead of the light event-style backgrounds. Names and hex
// codes accepted by MCP are mapped to this palette.
export const COUNTDOWN_COLOR_OPTIONS = [
  { name: 'blue', value: 'bg-blue-500', hex: '#3B82F6' },
  { name: 'green', value: 'bg-green-500', hex: '#22C55E' },
  { name: 'yellow', value: 'bg-yellow-500', hex: '#EAB308' },
  { name: 'amber', value: 'bg-amber-500', hex: '#F59E0B' },
  { name: 'red', value: 'bg-red-500', hex: '#EF4444' },
  { name: 'purple', value: 'bg-purple-500', hex: '#A855F7' },
  { name: 'pink', value: 'bg-pink-500', hex: '#EC4899' },
  { name: 'indigo', value: 'bg-indigo-500', hex: '#6366F1' },
  { name: 'orange', value: 'bg-orange-500', hex: '#F97316' },
  { name: 'teal', value: 'bg-teal-500', hex: '#14B8A6' },
] as const

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
