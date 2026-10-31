/**
 * Whether the control bar's buttons fit a phone at a proper touch size.
 *
 * Five labelled targets share one row for both roles; the organiser's End for
 * all action lives in More. jsdom cannot measure layout, so these budgets are
 * checked alongside the literal classes in the rendered component.
 */

/**
 * Tailwind's spacing step, so a class name can be checked against a pixel
 * budget. The classes themselves must stay literal for Tailwind to emit them,
 * which is exactly why the two can drift — `TAILWIND_STEP` is what lets a test
 * assert they have not.
 */
export const TAILWIND_STEP = 4

/**
 * Minimum width of a primary phone control. Rendered as `size-12`.
 */
export const TOUCH_TARGET = 12 * TAILWIND_STEP

/** Room for both icon and caption. Rendered as `h-16`. */
export const MOBILE_CONTROL_HEIGHT = 16 * TAILWIND_STEP

/**
 * Horizontal padding the bar reserves on each side below `sm`.
 *
 * Rendered as `px-3`.
 */
export const MOBILE_BAR_PADDING = 3 * TAILWIND_STEP

/** Minimum space kept between two neighbouring buttons. Rendered as `gap-0.5`. */
const MIN_GAP = 0.5 * TAILWIND_STEP

/** Gap between the primary buttons. Rendered as `gap-2`. */
export const PRIMARY_GAP = 2 * TAILWIND_STEP

/**
 * Separation between the toggles and the destructive Leave button.
 *
 * Twice the ordinary gap on top of it: Leave used to sit one 8px gap from Mute,
 * so hanging up was a thumb-slip from muting. Rendered as `ml-4` plus the
 * row's own `gap-2`.
 */
export const DESTRUCTIVE_SEPARATION = 4 * TAILWIND_STEP + PRIMARY_GAP

/** Secondary toggles: share, reactions, people, chat, settings. */
export const SECONDARY_CONTROL_COUNT = 5

/**
 * The phone's single row: mic, camera, hand, More, Leave.
 *
 * Five, not eleven. Two rows of identically-sized circles gave every control
 * the same visual weight — settings looked as important as the mic — and cost
 * 112px of a 640px viewport to say it. A phone bar is a few large targets with
 * an obvious primary pair; everything rarer goes behind More.
 */
export const MOBILE_CONTROL_COUNT = 5

/**
 * The width a full-bleed row of controls actually gets on a phone.
 *
 * Both roles have the same width. safeAreaX is the sum of left and right insets.
 */
export function mobileRowWidth(viewportWidth: number, safeAreaX = 0): number {
  return Math.max(0, viewportWidth - 2 * MOBILE_BAR_PADDING - safeAreaX)
}

/** Width `count` buttons need at `target`, minimum gaps included. */
export function buttonRowWidth(count: number, target = TOUCH_TARGET): number {
  if (count <= 0) return 0
  return count * target + (count - 1) * MIN_GAP
}

/**
 * A hypothetical secondary row's budget. The mobile UI uses a wrapping sheet
 * instead; this remains useful when comparing layout alternatives.
 */
export function secondaryRowFits(
  viewportWidth: number,
  count = SECONDARY_CONTROL_COUNT,
  target = TOUCH_TARGET,
): boolean {
  return buttonRowWidth(count, target) <= mobileRowWidth(viewportWidth)
}

/**
 * Width the phone's row needs: four grouped targets, then Leave held away.
 */
export function primaryRowWidth(target = TOUCH_TARGET): number {
  const buttons = MOBILE_CONTROL_COUNT * target
  const between = (MOBILE_CONTROL_COUNT - 2) * PRIMARY_GAP
  return buttons + between + DESTRUCTIVE_SEPARATION
}

/** Whether all five primary controls fit without shrinking their targets. */
export function primaryRowFits(
  viewportWidth: number,
  target = TOUCH_TARGET,
  safeAreaX = 0,
): boolean {
  return primaryRowWidth(target) <= mobileRowWidth(viewportWidth, safeAreaX)
}

/**
 * Whether the whole bar works at this width, for guests and organisers alike.
 */
export function controlBarFits(viewportWidth: number): boolean {
  return primaryRowFits(viewportWidth)
}

/** Vertical padding on the phone's row, per side. Rendered as `py-2.5`. */
const MOBILE_ROW_PADDING_Y = 2.5 * TAILWIND_STEP

/**
 * One labelled row, vertical padding, top border, and the device's bottom inset.
 */
export function mobileBarHeight(safeAreaBottom = 0): number {
  return MOBILE_ROW_PADDING_Y * 2 + MOBILE_CONTROL_HEIGHT + 1 + safeAreaBottom
}

/**
 * The share of a portrait viewport the video stage keeps once the bar is drawn.
 *
 * The filmstrip is collapsed by default on a portrait phone
 * (`prefersCollapsedFilmstrip` in lib/video-layout) and the chat and people
 * panels overlay the stage rather than splitting it below `sm`, so neither takes
 * further height from this — the bar is the whole vertical cost.
 */
export function portraitStageFraction(
  viewportHeight: number,
  safeAreaBottom = 0,
): number {
  if (viewportHeight <= 0) return 0
  return (
    Math.max(0, viewportHeight - mobileBarHeight(safeAreaBottom)) /
    viewportHeight
  )
}

/**
 * Whether the stage still gets the majority of a portrait phone. Four fifths is
 * the line: below it the controls stop being a bar and start being the page.
 */
export function portraitStageIsUsable(
  viewportHeight: number,
  safeAreaBottom = 0,
): boolean {
  return portraitStageFraction(viewportHeight, safeAreaBottom) >= 0.8
}
