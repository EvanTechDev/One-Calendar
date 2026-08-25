import { describe, expect, it } from 'vitest'
import { filmstripIsOpen } from '../../../apps/meet/lib/video-layout'

/**
 * The reported bug: pin someone, collapse the strip, open chat, close chat, and
 * the strip is expanded again. The cause was not a remount — opening a panel
 * takes 320px off the stage, which crosses the phone threshold, so a
 * stage-derived sync fired on every panel toggle and overwrote the choice.
 */
describe('filmstripIsOpen', () => {
  const desktop = { width: 1280, height: 720 }
  // What a desktop stage becomes with a 320px panel open.
  const desktopWithPanel = { width: 960, height: 720 }
  const phonePortrait = { width: 390, height: 640 }
  // A phone stage with the panel overlaying it is narrower still.
  const phoneWithPanel = { width: 390, height: 640 }

  it('opens by default on a stage with room for a strip', () => {
    expect(filmstripIsOpen(desktop, null)).toBe(true)
  })

  it('starts collapsed on a portrait phone', () => {
    expect(filmstripIsOpen(phonePortrait, null)).toBe(false)
  })

  it('keeps a collapse across a panel opening and closing', () => {
    // The exact reported sequence, as the three stage sizes it produces.
    expect(filmstripIsOpen(desktop, false)).toBe(false)
    expect(filmstripIsOpen(desktopWithPanel, false)).toBe(false)
    expect(filmstripIsOpen(desktop, false)).toBe(false)
  })

  it('keeps an expansion on a phone across a panel toggle', () => {
    // The mirror case: a viewer who opened the strip on a phone should not have
    // it collapsed for them either.
    expect(filmstripIsOpen(phonePortrait, true)).toBe(true)
    expect(filmstripIsOpen(phoneWithPanel, true)).toBe(true)
    expect(filmstripIsOpen(phonePortrait, true)).toBe(true)
  })

  it('lets the stage decide again only when there is no choice', () => {
    expect(filmstripIsOpen(phonePortrait, null)).toBe(false)
    expect(filmstripIsOpen(desktop, null)).toBe(true)
  })

  it('treats an unmeasured stage as having room', () => {
    // First paint has no box yet; collapsing then would flash the toggle.
    expect(filmstripIsOpen({ width: 0, height: 0 }, null)).toBe(true)
  })
})
