export const COLOR_OPTIONS = [
  { name: 'blue', value: 'bg-[#E6F6FD]', hex: '#3B82F6' },
  { name: 'green', value: 'bg-[#E7F8F2]', hex: '#10B981' },
  { name: 'amber', value: 'bg-[#FEF5E6]', hex: '#F59E0B' },
  { name: 'red', value: 'bg-[#FFE4E6]', hex: '#EF4444' },
  { name: 'purple', value: 'bg-[#F3EEFE]', hex: '#8B5CF6' },
  { name: 'pink', value: 'bg-[#FCE7F3]', hex: '#EC4899' },
  { name: 'indigo', value: 'bg-[#EEF2FF]', hex: '#6366F1' },
  { name: 'orange', value: 'bg-[#FFF0E5]', hex: '#FB923C' },
  { name: 'teal', value: 'bg-[#E6FAF7]', hex: '#14B8A6' },
] as const

export const COLOR_NAMES = COLOR_OPTIONS.map((c) => c.name)

export const COLOR_NAME_LIST = COLOR_NAMES.join(', ')

export const COLOR_HEX_VALUES = COLOR_OPTIONS.map((c) => c.hex)

export const COLOR_HEX_LIST = COLOR_HEX_VALUES.join(', ')

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
