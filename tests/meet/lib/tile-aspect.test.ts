import { describe, expect, it } from 'vitest'
import {
  fitCoverage,
  targetCellAspect,
  videoGridColumns,
} from '../../../apps/meet/lib/video-layout'

/**
 * Camera video used `object-cover`, which scales the frame up and cuts its
 * edges off to fill whatever cell shape the grid produced. It is fitted whole
 * now, so the mismatch shows as letterbox bars instead of missing face — and
 * the cell shape is the only remaining lever for keeping those bars small.
 */
describe('targetCellAspect', () => {
  it('falls back to 16:9 when no dimensions have arrived', () => {
    // A track's dimensions are absent until the first frame is negotiated;
    // 16:9 is the right guess for a webcam in the meantime.
    expect(targetCellAspect([])).toBeCloseTo(16 / 9)
  })

  it('follows a room of portrait phones instead of assuming 16:9', () => {
    const portrait = 9 / 16
    expect(targetCellAspect([portrait, portrait, portrait])).toBeCloseTo(
      portrait,
    )
  })

  it('takes the median, so one odd source does not drag the rest', () => {
    // A very wide source among landscape cameras: the mean would pull every
    // cell wide and letterbox all the cameras to accommodate one tile.
    const wide = 32 / 9
    const camera = 16 / 9
    expect(targetCellAspect([camera, camera, camera, wide])).toBeCloseTo(
      camera,
      5,
    )
  })

  it('ignores unusable values rather than poisoning the median', () => {
    // NaN is what a track with no dimensions yet contributes.
    expect(targetCellAspect([Number.NaN, 16 / 9, 0, -1])).toBeCloseTo(16 / 9)
  })

  it('averages the middle pair for an even count', () => {
    expect(targetCellAspect([1, 2, 3, 4])).toBeCloseTo(2.5)
  })
})

describe('fitCoverage', () => {
  it('is 1 when the frame and the cell agree', () => {
    expect(fitCoverage(16 / 9, 16 / 9)).toBeCloseTo(1)
  })

  it('is symmetric: too wide costs the same as too tall', () => {
    // Log-space scoring elsewhere relies on this; a linear measure would
    // quietly prefer one kind of mismatch.
    expect(fitCoverage(2, 1)).toBeCloseTo(fitCoverage(1, 2))
  })

  it('quantifies the cost of a portrait frame in a 16:9 cell', () => {
    // The case that made `object-cover` so destructive: fitted whole this shows
    // as ~32% coverage, and cropping to fill instead threw the other 68% away.
    expect(fitCoverage(9 / 16, 16 / 9)).toBeCloseTo(0.316, 2)
  })

  it('is 0 for a degenerate input rather than Infinity or NaN', () => {
    expect(fitCoverage(0, 16 / 9)).toBe(0)
    expect(fitCoverage(16 / 9, 0)).toBe(0)
    expect(fitCoverage(Number.NaN, 1)).toBe(0)
  })
})

describe('videoGridColumns with a source aspect', () => {
  const desktop = { width: 1280, height: 720 }

  it('defaults to the 16:9 behaviour when no aspect is given', () => {
    // The old signature has to keep working; this is the regression guard for
    // every existing caller and test.
    expect(videoGridColumns(4, desktop)).toBe(
      videoGridColumns(4, desktop, 16 / 9),
    )
  })

  it('chooses cells that fit portrait sources better than 16:9 cells would', () => {
    const portrait = 9 / 16
    const columns = videoGridColumns(4, desktop, portrait)
    const rows = Math.ceil(4 / columns)
    const cell = desktop.width / columns / (desktop.height / rows)

    const naive = videoGridColumns(4, desktop)
    const naiveRows = Math.ceil(4 / naive)
    const naiveCell = desktop.width / naive / (desktop.height / naiveRows)

    // The whole point: aiming at the real aspect must waste no more area than
    // aiming at 16:9 did, and here it wastes less.
    expect(fitCoverage(portrait, cell)).toBeGreaterThanOrEqual(
      fitCoverage(portrait, naiveCell),
    )
  })

  it('still respects the tier caps with an unusual aspect', () => {
    // A pathological aspect must not talk the search past the row/column caps
    // that keep off-screen tiles unmounted.
    const phone = { width: 390, height: 640 }
    expect(videoGridColumns(4, phone, 32 / 9)).toBeLessThanOrEqual(2)
  })

  it('ignores a non-positive aspect instead of dividing by it', () => {
    expect(videoGridColumns(4, desktop, 0)).toBe(videoGridColumns(4, desktop))
    expect(videoGridColumns(4, desktop, -2)).toBe(videoGridColumns(4, desktop))
  })

  it('keeps a single tile at one column whatever its shape', () => {
    expect(videoGridColumns(1, desktop, 9 / 16)).toBe(1)
  })
})
