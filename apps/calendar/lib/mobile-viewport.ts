/**
 * True when the viewport is below the 768px breakpoint — the boundary
 * between the Desktop Form and the Mobile Form (ADR-0018).
 *
 * For *behaviour* differences only (disabling drags, opening sheets);
 * layout differences use CSS breakpoints. Guarded so environments without
 * matchMedia (jsdom, SSR) always answer "desktop", which keeps the desktop
 * code path the default everywhere.
 */
export function isMobileViewport(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 767px)').matches
  )
}
