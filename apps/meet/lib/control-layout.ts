/**
 * Whether the control bar's buttons fit a phone at a proper touch size.
 *
 * The mobile bar used to hide six controls behind a dropdown because nine 32px
 * buttons in one row did not fit. The row did not fit for a second reason,
 * though: the bar is a three-track grid, and with the identity block hidden
 * below `sm` the controls got a single `minmax(0,1fr)` track — roughly half the
 * viewport — while the third track sat empty. Reclaiming the full width is what
 * makes a visible secondary row possible at all.
 *
 * The arithmetic lives here, as pure functions over a viewport width, for the
 * same reason lib/video-layout does: "do six 44px buttons fit a 360px phone
 * while the Organiser also has an End button" is a claim worth proving, and a
 * jsdom render has no layout to prove it with.
 */

/**
 * Tailwind's spacing step, so a class name can be checked against a pixel
 * budget. The classes themselves must stay literal for Tailwind to emit them,
 * which is exactly why the two can drift — `TAILWIND_STEP` is what lets a test
 * assert they have not.
 */
export const TAILWIND_STEP = 4

/**
 * Touch target for every control on a phone — 44px, the iOS minimum and the
 * floor Android's 48dp guidance rounds from. Uniform because it fits: nothing
 * here has to be shrunk to make room (see `secondaryRowFits`).
 *
 * Rendered as `size-11`.
 */
export const TOUCH_TARGET = 11 * TAILWIND_STEP

/**
 * Horizontal padding the bar reserves on each side below `sm`.
 *
 * Rendered as `px-3`.
 */
export const MOBILE_BAR_PADDING = 3 * TAILWIND_STEP

/** Minimum space kept between two neighbouring buttons. Rendered as `gap-0.5`. */
export const MIN_GAP = 0.5 * TAILWIND_STEP

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

/** Secondary toggles: share, hand, reactions, people, chat, settings. */
export const SECONDARY_CONTROL_COUNT = 6

/** Primary line: mic, camera, the details menu, and Leave. */
export const PRIMARY_CONTROL_COUNT = 4

/**
 * The width a full-bleed row of controls actually gets on a phone.
 *
 * The Organiser's End button shares the primary line, so it is subtracted
 * rather than assumed away. The secondary row is a row of its own and never
 * pays for it.
 */
export function mobileRowWidth(
  viewportWidth: number,
  isOrganiser = false,
): number {
  const usable = viewportWidth - 2 * MOBILE_BAR_PADDING
  const organiserCost = isOrganiser ? TOUCH_TARGET + PRIMARY_GAP : 0
  return Math.max(0, usable - organiserCost)
}

/** Width `count` buttons need at `target`, minimum gaps included. */
export function buttonRowWidth(count: number, target = TOUCH_TARGET): number {
  if (count <= 0) return 0
  return count * target + (count - 1) * MIN_GAP
}

/**
 * Whether all six secondary toggles fit one row — that is, whether every one of
 * them is reachable in one tap rather than behind a menu.
 */
export function secondaryRowFits(
  viewportWidth: number,
  count = SECONDARY_CONTROL_COUNT,
  target = TOUCH_TARGET,
): boolean {
  // Never `isOrganiser`: this row is its own line, above the primary one.
  return buttonRowWidth(count, target) <= mobileRowWidth(viewportWidth)
}

/**
 * Width the primary line needs: mic, camera and the details menu together, then
 * Leave held away from them.
 */
export function primaryRowWidth(target = TOUCH_TARGET): number {
  const buttons = PRIMARY_CONTROL_COUNT * target
  const between = (PRIMARY_CONTROL_COUNT - 2) * PRIMARY_GAP
  return buttons + between + DESTRUCTIVE_SEPARATION
}

/** Whether the primary line fits, Organiser End button included. */
export function primaryRowFits(
  viewportWidth: number,
  isOrganiser = false,
  target = TOUCH_TARGET,
): boolean {
  return primaryRowWidth(target) <= mobileRowWidth(viewportWidth, isOrganiser)
}

/**
 * Whether the whole bar works at this width — both rows, in the hardest case
 * (an Organiser, who carries the extra End button).
 */
export function controlBarFits(viewportWidth: number): boolean {
  return (
    secondaryRowFits(viewportWidth) &&
    primaryRowFits(viewportWidth, true) &&
    primaryRowFits(viewportWidth, false)
  )
}

/** Vertical padding above the secondary row. Rendered as `pt-2`. */
const SECONDARY_ROW_PADDING_TOP = 2 * TAILWIND_STEP

/** Vertical padding on the primary row, per side. Rendered as `py-2`. */
const PRIMARY_ROW_PADDING_Y = 2 * TAILWIND_STEP

/**
 * The bar's height on a phone.
 *
 * A second row is not free: this went from 56px to 112px, and the identity block
 * was previously taken off its own row precisely because ~34px of a 640px
 * viewport mattered. The trade is deliberate — that row bought back a hidden
 * chat badge and one-tap reactions — but it is a budget, so it is stated and
 * checked rather than assumed (`portraitStageIsUsable`).
 */
export function mobileBarHeight(): number {
  return (
    SECONDARY_ROW_PADDING_TOP +
    TOUCH_TARGET +
    PRIMARY_ROW_PADDING_Y * 2 +
    TOUCH_TARGET
  )
}

/**
 * The share of a portrait viewport the video stage keeps once the bar is drawn.
 *
 * The filmstrip is collapsed by default on a portrait phone
 * (`prefersCollapsedFilmstrip` in lib/video-layout) and the chat and people
 * panels overlay the stage rather than splitting it below `sm`, so neither takes
 * further height from this — the bar is the whole vertical cost.
 */
export function portraitStageFraction(viewportHeight: number): number {
  if (viewportHeight <= 0) return 0
  return Math.max(0, viewportHeight - mobileBarHeight()) / viewportHeight
}

/**
 * Whether the stage still gets the majority of a portrait phone. Four fifths is
 * the line: below it the controls stop being a bar and start being the page.
 */
export function portraitStageIsUsable(viewportHeight: number): boolean {
  return portraitStageFraction(viewportHeight) >= 0.8
}
