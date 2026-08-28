import { cn } from '@zntr/utils'

/**
 * The Zentra logo, switched between its light and dark artwork.
 *
 * Both variants are rendered and one is hidden with `dark:`, rather than
 * choosing a `src` from `useTheme()`. `resolvedTheme` is undefined until
 * next-themes has mounted, so a JS choice either renders nothing on the first
 * paint or renders the wrong variant and corrects itself — a visible flash on
 * every load. A CSS toggle is settled by the `.dark` class that next-themes
 * writes before paint, so the correct artwork is right the first time and this
 * stays a server component.
 *
 * The logo is artwork, not a glyph: it carries its own gradient and fills, so
 * unlike the old monochrome mark it cannot be recoloured with `currentColor`
 * (and must not be, since `brightness-0 dark:invert` would destroy the
 * gradient). That is why there are two files rather than one tinted one.
 *
 * `aria-hidden` when a visible brand name sits beside it — otherwise a screen
 * reader announces "Zentra Calendar" twice.
 */
export function ZentraLogo({
  className,
  label = 'Zentra Calendar',
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
