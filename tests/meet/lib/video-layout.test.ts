import { describe, it, expect } from 'vitest'
import {
  maxFilmstripTiles,
  maxTilesPerPage,
  prefersCollapsedFilmstrip,
  stageTier,
  videoGridColumns,
} from '@/lib/video-layout'

/** Representative stages, measured as the stage box rather than the window. */
const PHONE_PORTRAIT = { width: 360, height: 560 }
const PHONE_LANDSCAPE = { width: 720, height: 340 }
const TABLET = { width: 820, height: 1100 }
const TABLET_LANDSCAPE = { width: 1000, height: 700 }
const DESKTOP = { width: 1280, height: 800 }
const WIDE = { width: 1920, height: 1080 }

describe('stageTier', () => {
  it('bands on the same breakpoints the repo uses elsewhere', () => {
    expect(stageTier(320)).toBe('phone')
    expect(stageTier(639)).toBe('phone')
    expect(stageTier(640)).toBe('tablet')
    expect(stageTier(1023)).toBe('tablet')
    expect(stageTier(1024)).toBe('desktop')
    expect(stageTier(1535)).toBe('desktop')
    expect(stageTier(1536)).toBe('wide')
  })
})

describe('maxTilesPerPage', () => {
  it('gives a phone far fewer tiles than a desktop', () => {
    expect(maxTilesPerPage(PHONE_PORTRAIT)).toBe(4)
    expect(maxTilesPerPage(TABLET)).toBe(6)
    expect(maxTilesPerPage(DESKTOP)).toBe(9)
    expect(maxTilesPerPage(WIDE)).toBe(16)
  })

  it('trims the page on a short stage, which has no room for a third row', () => {
    // Landscape phone: wide enough to look like a tablet, far too short.
    expect(maxTilesPerPage(PHONE_LANDSCAPE)).toBe(6)
    expect(maxTilesPerPage({ width: 1280, height: 320 })).toBe(8)
  })

  it('never returns more tiles than its grid can arrange', () => {
    for (const stage of [
      PHONE_PORTRAIT,
      PHONE_LANDSCAPE,
      TABLET,
      DESKTOP,
      WIDE,
    ]) {
      const cap = maxTilesPerPage(stage)
      const columns = videoGridColumns(cap, stage)
      expect(columns).toBeGreaterThanOrEqual(1)
      expect(Math.ceil(cap / columns) * columns).toBeGreaterThanOrEqual(cap)
    }
  })

  it('is always a positive integer', () => {
    for (const width of [0, 100, 360, 640, 1024, 1536, 4000]) {
      const cap = maxTilesPerPage({ width, height: 800 })
      expect(Number.isInteger(cap)).toBe(true)
      expect(cap).toBeGreaterThan(0)
    }
  })
})

describe('videoGridColumns', () => {
  it('gives a single tile the whole stage', () => {
    expect(videoGridColumns(1, PHONE_PORTRAIT)).toBe(1)
    expect(videoGridColumns(1, WIDE)).toBe(1)
    expect(videoGridColumns(0, WIDE)).toBe(1)
  })

  it('caps a portrait phone at two columns', () => {
    // The reported bug: 10 participants on a 360px stage used to be 4 columns
    // of 90px slivers.
    for (const count of [2, 3, 4, 6, 10]) {
      expect(videoGridColumns(count, PHONE_PORTRAIT)).toBeLessThanOrEqual(2)
    }
  })

  it('stacks two tiles on a portrait phone instead of splitting them', () => {
    expect(videoGridColumns(2, PHONE_PORTRAIT)).toBe(1)
  })

  it('widens as the stage widens for the same participant count', () => {
    const counts = [4, 6, 9]
    for (const count of counts) {
      const phone = videoGridColumns(count, PHONE_PORTRAIT)
      const tablet = videoGridColumns(count, TABLET_LANDSCAPE)
      const desktop = videoGridColumns(count, DESKTOP)
      expect(phone).toBeLessThanOrEqual(tablet)
      expect(tablet).toBeLessThanOrEqual(desktop)
    }
  })

  it('honours the per-tier column ceiling', () => {
    expect(videoGridColumns(20, PHONE_LANDSCAPE)).toBeLessThanOrEqual(3)
    expect(videoGridColumns(20, TABLET_LANDSCAPE)).toBeLessThanOrEqual(3)
    expect(videoGridColumns(20, DESKTOP)).toBeLessThanOrEqual(4)
    expect(videoGridColumns(20, WIDE)).toBeLessThanOrEqual(5)
  })

  it('never returns more columns than there are tiles', () => {
    for (const stage of [PHONE_PORTRAIT, TABLET, DESKTOP, WIDE]) {
      for (const count of [1, 2, 3, 5, 8]) {
        expect(videoGridColumns(count, stage)).toBeLessThanOrEqual(count)
      }
    }
  })

  it('keeps tiles within a sane aspect band on a normal stage', () => {
    // The letterboxing complaint: no tile should be more than ~3x from 16:9.
    for (const count of [2, 3, 4, 5, 6, 8, 9]) {
      const columns = videoGridColumns(count, DESKTOP)
      const rows = Math.ceil(count / columns)
      const aspect = DESKTOP.width / columns / (DESKTOP.height / rows)
      expect(aspect).toBeGreaterThan(16 / 9 / 3)
      expect(aspect).toBeLessThan((16 / 9) * 3)
    }
  })

  it('reacts to an extreme stage ratio rather than letterboxing', () => {
    // A very wide, very short stage spreads out instead of stacking.
    expect(videoGridColumns(4, { width: 1600, height: 260 })).toBe(4)
    // A very tall, narrow one stacks as far as the row cap allows: one column
    // would need four rows, so it settles at two.
    expect(videoGridColumns(4, { width: 420, height: 1400 })).toBe(2)
    expect(videoGridColumns(2, { width: 420, height: 1400 })).toBe(1)
  })

  it('treats an unmeasured stage as the most conservative tier', () => {
    // Rendered before the ResizeObserver reports. Erring towards the phone
    // tier means the first paint mounts the FEWEST tiles, so a desktop grows
    // into its page rather than opening subscriptions it then tears down.
    expect(videoGridColumns(4, { width: 0, height: 0 })).toBe(2)
    expect(videoGridColumns(9, { width: 0, height: 0 })).toBe(2)
    expect(maxTilesPerPage({ width: 0, height: 0 })).toBe(4)
    expect(Number.isFinite(videoGridColumns(6, { width: 0, height: 0 }))).toBe(
      true,
    )
  })

  it('always returns a positive integer', () => {
    for (const stage of [
      PHONE_PORTRAIT,
      PHONE_LANDSCAPE,
      TABLET,
      DESKTOP,
      WIDE,
      { width: 0, height: 0 },
    ]) {
      for (const count of [1, 2, 3, 4, 7, 16, 40]) {
        const columns = videoGridColumns(count, stage)
        expect(Number.isInteger(columns)).toBe(true)
        expect(columns).toBeGreaterThan(0)
      }
    }
  })
})

describe('maxFilmstripTiles', () => {
  it('keeps the strip shorter on a phone', () => {
    expect(maxFilmstripTiles(PHONE_PORTRAIT)).toBe(4)
    expect(maxFilmstripTiles(DESKTOP)).toBe(8)
  })
})

describe('prefersCollapsedFilmstrip', () => {
  it('collapses only on a portrait phone, where the strip would not fit', () => {
    expect(prefersCollapsedFilmstrip(PHONE_PORTRAIT)).toBe(true)
    expect(prefersCollapsedFilmstrip(PHONE_LANDSCAPE)).toBe(false)
    expect(prefersCollapsedFilmstrip(TABLET)).toBe(false)
    expect(prefersCollapsedFilmstrip(DESKTOP)).toBe(false)
  })

  it('does not collapse on an unmeasured stage', () => {
    expect(prefersCollapsedFilmstrip({ width: 0, height: 0 })).toBe(false)
  })
})
