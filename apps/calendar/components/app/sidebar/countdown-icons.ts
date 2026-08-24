import * as lucideIcons from 'lucide-react'
import {
  COUNTDOWN_ICON_GROUPS as CATALOGUE_GROUPS,
  type CountdownIconGroup,
} from '@/lib/countdown-icons'

/**
 * Client-side view of the countdown icon catalogue.
 *
 * The catalogue itself lives in `@/lib/countdown-icons` so the MCP tool schema
 * can validate against the same list without pulling `lucide-react` into the
 * server bundle. This module adds the lucide-dependent parts: filtering out
 * names lucide no longer exports, and searching the full library.
 */
export type { CountdownIconGroup }
export {
  COUNTDOWN_ICON_NAMES as CATALOGUE_ICON_NAMES,
  DEFAULT_COUNTDOWN_ICON,
  isCountdownIconName,
} from '@/lib/countdown-icons'

/** True when lucide actually exports this icon. */
export function isLucideIconName(name: string): boolean {
  return name in lucideIcons
}

/**
 * Groups with unavailable icons filtered out, so a lucide rename shows a
 * shorter list rather than blank cells.
 */
export const COUNTDOWN_ICON_GROUPS: CountdownIconGroup[] = CATALOGUE_GROUPS.map(
  (group) => ({ ...group, icons: group.icons.filter(isLucideIconName) }),
).filter((group) => group.icons.length > 0)

export const COUNTDOWN_ICON_NAMES: string[] = COUNTDOWN_ICON_GROUPS.flatMap(
  (group) => group.icons,
)

/**
 * Searches the catalogue only.
 *
 * There is deliberately no fallback to the full lucide library: the write path
 * (`countdownSchema`) and the MCP tool schema both reject names outside the
 * catalogue, so offering one here would let the user pick an icon whose save
 * then fails.
 */
export function searchCountdownIcons(keyword: string): string[] {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return COUNTDOWN_ICON_NAMES
  return COUNTDOWN_ICON_NAMES.filter((name) =>
    name.toLowerCase().includes(needle),
  )
}
