/**


 * Nesting bookkeeping for the stacked floating surfaces: a month/year view's
 * "N more events" list, and the event preview opened from one of its rows.
 *
 * Radix gives every popover its OWN dismissable layer, and the preview is
 * PORTALLED to `<body>` — so from the list's layer, a pointerdown inside the
 * preview is not "inside the list" but somewhere out in the document, and a
 * focus move into it (which is what pressing the preview's own close button
 * does) is the same story. Both paths end at `onInteractOutside`, and the list
 * handled neither, so closing one event's preview took the whole list down
 * with it.
 *
 * Radix has an answer for this — `DismissableLayerBranch` — but it is not part
 * of the public popover API, and it would not have helped here anyway: a branch
 * only excuses the POINTERDOWN, never the focus move, and the focus move is
 * half the problem. So the contract is declared in the DOM instead: a child
 * overlay tags its content, and the parent popover declines to dismiss for
 * interactions carrying that tag.
 *
 * One-directional on purpose. The parent still dismisses on any interaction
 * outside BOTH surfaces, so clicking another row swaps the preview, clicking
 * the list's own ✕ drops both, and Escape still closes only the topmost one.
 */

/** Marks floating content that its parent popover must treat as "inside". */
export const CHILD_OVERLAY_ATTRIBUTE = 'data-child-overlay'

/** Spread onto a child overlay's content element. */
export const childOverlayProps = {
  [CHILD_OVERLAY_ATTRIBUTE]: '',
} as const

/**
 * True when the interaction an `onInteractOutside` handler is being told
 * about — a pointerdown or a focus move, the handler cannot tell which —
 * originated inside a child overlay rather than genuinely outside.
 */
export function isChildOverlayInteraction(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(`[${CHILD_OVERLAY_ATTRIBUTE}]`) !== null
  )
}
