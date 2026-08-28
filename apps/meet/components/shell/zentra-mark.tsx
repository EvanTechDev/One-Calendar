import { cn } from '@zntr/utils'

/**
 * The Zentra logo, so the meet Shell's brand block matches the calendar's
 * sidebar. Duplicated rather than shared because apps never import each other
 * and a single glyph does not justify a packages/ui entry (ADR 0017's rule
 * applies to code, but the same structure decides this). Kept in lockstep with
 * the calendar's components/brand/zentra-logo.tsx.
 *
 * Both variants render and one is hidden with `dark:`, rather than choosing a
 * `src` from `useTheme()`: `resolvedTheme` is undefined until next-themes has
 * mounted, so a JS choice flashes the wrong artwork on first paint. The CSS
 * toggle is settled by the `.dark` class before paint.
 *
 * The artwork carries its own gradient and fills, so it cannot be recoloured
 * with `currentColor` — the `brightness-0 dark:invert` that used to tint the
 * old monochrome mark would flatten the gradient and must not be reapplied.
 */
export function ZentraMark({
  className,
  label = 'Zentra Meet',
  decorative = false,
}: {
  className?: string
  /** Accessible name. Ignored when `decorative`. */
  label?: string
  /** True when adjacent text already names the brand. */
  decorative?: boolean
}) {
  const a11y = decorative
    ? { alt: '', 'aria-hidden': true as const }
    : { alt: label }

  return (
    <>
      <img
        src="/logo-light.svg"
        {...a11y}
        className={cn('block dark:hidden', className)}
      />
      <img
        src="/logo-dark.svg"
        {...a11y}
        className={cn('hidden dark:block', className)}
      />
    </>
  )
}
