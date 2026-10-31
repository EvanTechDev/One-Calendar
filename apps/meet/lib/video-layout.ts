/**
 * How many tiles a video stage shows, and how they are arranged.
 *
 * Pure functions over a measured stage size, for two reasons. First, the
 * previous rule (`count <= 4 ? 2 : count <= 9 ? 3 : 4`) capped columns but not
 * rows, so a 40-participant room rendered 40 subscribed tiles in a 4x10 grid —
 * every one of them a live subscription. Second, it ignored the viewport
 * entirely, so a phone got the same 4-column grid as a desktop and produced
 * unusable slivers.
 *
 * The stage's own box is the input rather than the window, because the chat and
 * people panels take 320px off the width — the space a tile actually gets is
 * what should decide the layout.
 */

/** Stage-width bands. Thresholds match Tailwind's sm / lg / 2xl. */
export type StageTier = 'phone' | 'tablet' | 'desktop' | 'wide'

export interface StageSize {
  width: number
  height: number
}

interface TierLimits {
  /** Hard cap on simultaneously mounted (and therefore subscribed) tiles. */
  maxTiles: number
  maxColumns: number
  /** Capping rows is what the old rule was missing. */
  maxRows: number
}

/**
 * A phone gets fewer tiles than a desktop because the cap is really a
 * legibility budget: below roughly 150x85 CSS pixels a tile shows a colour,
 * not a face. Each tier's `maxColumns * maxRows` is >= its `maxTiles`, so the
 * cap is always reachable.
 */
const LIMITS: Record<StageTier, TierLimits> = {
  phone: { maxTiles: 4, maxColumns: 2, maxRows: 3 },
  tablet: { maxTiles: 6, maxColumns: 3, maxRows: 3 },
  desktop: { maxTiles: 9, maxColumns: 4, maxRows: 3 },
  wide: { maxTiles: 16, maxColumns: 5, maxRows: 4 },
}

/**
 * The aspect a cell aims for when nothing better is known.
 *
 * A real publication's `dimensions` is preferred — a phone publishing portrait
 * is not 16:9, and assuming it was is what letterboxed or cropped it. This is
 * only the fallback for a track whose dimensions have not arrived yet.
 */
const TARGET_TILE_ASPECT = 16 / 9

/**
 * The aspect ratio a grid of `count` tiles should aim its cells at.
 *
 * Takes the sources' own aspects so a room of portrait phones gets portrait
 * cells instead of 16:9 cells with bars down both sides. The median, not the
 * mean: one screen-share-shaped outlier should not drag every camera cell.
 */
export function targetCellAspect(aspects: readonly number[]): number {
  const usable = aspects
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)
  if (usable.length === 0) return TARGET_TILE_ASPECT
  const middle = Math.floor(usable.length / 2)
  return usable.length % 2 === 1
    ? usable[middle]!
    : (usable[middle - 1]! + usable[middle]!) / 2
}

/**
 * The fraction of a cell a frame of `sourceAspect` actually covers when it is
 * fitted whole (never cropped) into a cell of `cellAspect`.
 *
 * 1 means a perfect fit. Lower means letterbox bars, which is the cost of not
 * cropping — this is what the column search minimises, rather than hiding the
 * mismatch by cutting the frame's edges off.
 */
export function fitCoverage(sourceAspect: number, cellAspect: number): number {
  if (!(sourceAspect > 0) || !(cellAspect > 0)) return 0
  return sourceAspect > cellAspect
    ? cellAspect / sourceAspect
    : sourceAspect / cellAspect
}

export function stageTier(width: number): StageTier {
  if (width < 640) return 'phone'
  if (width < 1024) return 'tablet'
  if (width < 1536) return 'desktop'
  return 'wide'
}

/**
 * The page size for tile pagination. Tiles beyond this are not rendered at
 * all, which is the whole point — an unmounted tile drops its subscription
 * via adaptiveStream, so a 40-person room costs one page of video, not 40.
 */
export function maxTilesPerPage(stage: StageSize): number {
  const limits = LIMITS[stageTier(stage.width)]
  // A landscape phone is wide but very short, so it fits a row less than its
  // width band suggests.
  if (stage.height > 0 && stage.height < 380) {
    return Math.min(limits.maxTiles, limits.maxColumns * 2)
  }
  return limits.maxTiles
}

/**
 * Columns for `count` tiles on a stage of this size.
 *
 * Chooses the column count whose cells come closest to the sources' own aspect,
 * within the tier's column and row caps. Scoring the shape rather than
 * hard-coding a count is what stops the two pathologies the maintainer hit:
 * absurd letterboxing at extreme stage ratios, and a phone splitting 360px
 * into four columns.
 *
 * `cellAspect` is the shape to aim at — pass the sources' median (see
 * `targetCellAspect`) so a room of portrait phones is not judged against 16:9.
 * Since frames are fitted whole rather than cropped, the cell shape is the only
 * lever left for reducing letterbox area.
 */
export function videoGridColumns(
  count: number,
  stage: StageSize,
  cellAspect: number = TARGET_TILE_ASPECT,
): number {
  if (count <= 1) return 1

  const limits = LIMITS[stageTier(stage.width)]
  const portrait = stage.height > stage.width
  // A portrait stage is taller than it is wide, so stacking beats splitting.
  const maxColumns = Math.min(
    count,
    portrait ? Math.min(limits.maxColumns, 2) : limits.maxColumns,
  )
  // Forcing enough columns to stay inside the row cap is what keeps four
  // tiles on a phone from becoming four 125px-tall bands.
  const minColumns = Math.min(
    maxColumns,
    Math.max(1, Math.ceil(count / limits.maxRows)),
  )

  const target = cellAspect > 0 ? cellAspect : TARGET_TILE_ASPECT

  // Degenerate sizes (a stage measured before layout) have no meaningful
  // aspect; fall back to the squarest arrangement the caps allow.
  if (stage.width <= 0 || stage.height <= 0) {
    return clamp(Math.ceil(Math.sqrt(count)), minColumns, maxColumns)
  }

  let best = minColumns
  let bestScore = Number.POSITIVE_INFINITY
  for (let columns = minColumns; columns <= maxColumns; columns += 1) {
    const rows = Math.ceil(count / columns)
    const tileAspect = stage.width / columns / (stage.height / rows)
    // Log-space distance, so "twice as wide" and "half as wide" are equally
    // wrong. A linear difference would quietly prefer the squashed side.
    const score = Math.abs(Math.log(tileAspect / target))
    // Strict improvement only, so a tie keeps the fewer columns — and with
    // them the larger tiles.
    if (score < bestScore) {
      bestScore = score
      best = columns
    }
  }
  return best
}

/**
 * Tiles in the focus-mode filmstrip. Much shorter than a grid page: the strip
 * scrolls, so its cost is bounded by what is mounted, and a phone in portrait
 * has to fit the strip, the stage and the control bar in one viewport.
 */
export function maxFilmstripTiles(stage: StageSize): number {
  return stageTier(stage.width) === 'phone' ? 4 : 8
}

/**
 * Whether the stage is too short to carry a filmstrip and a usable stage at
 * once — a phone held in portrait, in practice. Such a stage starts with the
 * strip collapsed behind its toggle.
 */
export function prefersCollapsedFilmstrip(stage: StageSize): boolean {
  if (stage.width <= 0 || stage.height <= 0) return false
  return stageTier(stage.width) === 'phone' && stage.height > stage.width
}

/**
 * Whether the filmstrip is open, given the stage and whatever the viewer chose.
 *
 * An explicit choice always wins. Opening a side panel narrows the stage past
 * the phone threshold, so deriving this from the stage alone re-collapsed and
 * re-expanded the strip on every panel toggle — the viewer's collapse came back
 * as soon as they closed chat.
 */
export function filmstripIsOpen(
  stage: StageSize,
  viewerChoice: boolean | null,
): boolean {
  return viewerChoice ?? !prefersCollapsedFilmstrip(stage)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
