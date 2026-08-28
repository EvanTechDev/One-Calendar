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

/**
 * True when the interaction being handled right now came from a finger.
 *
 * Drag gestures (drag-to-create, moving events, resize) are gated on this,
 * NOT on viewport width: a mouse drag must keep working even in a narrow
 * window, while a finger swipe must scroll rather than create (ADR-0019).
 *
 * Browsers fire compatibility mouse events after touch, so by the time a
 * mousedown handler runs, the pointerdown that preceded it has already
 * recorded its pointerType here. Environments without PointerEvent (jsdom)
 * never update it, so the answer stays "mouse" — the desktop code path.
 */
let lastPointerType = 'mouse'

if (typeof window !== 'undefined' && 'PointerEvent' in window) {
  window.addEventListener(
    'pointerdown',
    (e) => {
      lastPointerType = e.pointerType || 'mouse'
    },
    { capture: true, passive: true },
  )
}

export function isTouchInteraction(): boolean {
  return lastPointerType === 'touch'
}
