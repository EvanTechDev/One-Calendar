export type HorizontalPopoverSide = 'left' | 'right'

export interface HorizontalPopoverPlacement {
  side: HorizontalPopoverSide
  anchorX: number
}

const DEFAULT_CONTENT_WIDTH = 288
const DEFAULT_SIDE_OFFSET = 8
const DEFAULT_COLLISION_PADDING = 20

/** Chooses a side that can fit the fixed-width day popover when possible. */
export function getHorizontalPopoverPlacement(
  rect: Pick<DOMRect, 'left' | 'right'>,
  viewportWidth: number,
  contentWidth = DEFAULT_CONTENT_WIDTH,
  sideOffset = DEFAULT_SIDE_OFFSET,
  collisionPadding = DEFAULT_COLLISION_PADDING,
): HorizontalPopoverPlacement {
  const rightSpace = viewportWidth - rect.right - sideOffset - collisionPadding
  const leftSpace = rect.left - sideOffset - collisionPadding
  const side: HorizontalPopoverSide =
    rightSpace >= contentWidth
      ? 'right'
      : leftSpace >= contentWidth
        ? 'left'
        : rightSpace >= leftSpace
          ? 'right'
          : 'left'

  return { side, anchorX: side === 'right' ? rect.right : rect.left }
}
