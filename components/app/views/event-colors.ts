export function getEventAccentColor(color?: string) {
  const colorMapping: Record<string, string> = {
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

  if (!color) return '#3A3A3A'
  return colorMapping[color] || '#3A3A3A'
}

export function getEventBackgroundColor(
  color: string | undefined,
  isDark: boolean,
) {
  if (!isDark || !color) return undefined

  const darkModeColorMapping: Record<string, string> = {
    'bg-[#E6F6FD]': '#2F4655',
    'bg-[#E7F8F2]': '#2D4935',
    'bg-[#FEF5E6]': '#4F3F1B',
    'bg-[#FFE4E6]': '#6C2920',
    'bg-[#F3EEFE]': '#483A63',
    'bg-[#FCE7F3]': '#5A334A',
    'bg-[#E6FAF7]': '#1F4A47',
  }

  return darkModeColorMapping[color]
}
