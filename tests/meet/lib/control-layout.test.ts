import { describe, expect, it } from 'vitest'
import {
  DESTRUCTIVE_SEPARATION,
  MOBILE_CONTROL_HEIGHT,
  PRIMARY_GAP,
  SECONDARY_CONTROL_COUNT,
  TOUCH_TARGET,
  buttonRowWidth,
  controlBarFits,
  mobileBarHeight,
  mobileRowWidth,
  portraitStageFraction,
  portraitStageIsUsable,
  primaryRowFits,
  primaryRowWidth,
  secondaryRowFits,
} from '../../../apps/meet/lib/control-layout'

/**
 * The maintainer's two target viewports. The control bar has to work at both,
 * in portrait — which is the claim these tests exist to prove, since a jsdom
 * render has no layout to prove it with.
 */
const SMALL_PHONE = 360
const IPHONE_PRO = 390

describe('control bar touch targets', () => {
  it('meets a 48px touch target on both axes', () => {
    expect(TOUCH_TARGET).toBeGreaterThanOrEqual(48)
    expect(MOBILE_CONTROL_HEIGHT).toBeGreaterThanOrEqual(48)
  })

  it('separates the destructive action further than the ordinary gap', () => {
    // Leave sat one 8px gap from Mute, so hanging up was a thumb-slip away.
    expect(DESTRUCTIVE_SEPARATION).toBeGreaterThan(PRIMARY_GAP * 2)
  })
})

describe('mobileRowWidth', () => {
  it('subtracts the bar padding from the viewport', () => {
    expect(mobileRowWidth(SMALL_PHONE)).toBe(SMALL_PHONE - 24)
  })

  it('reserves horizontal safe-area insets', () => {
    expect(mobileRowWidth(SMALL_PHONE, 20)).toBe(SMALL_PHONE - 24 - 20)
  })

  it('never reports a negative width for an absurd viewport', () => {
    expect(mobileRowWidth(10)).toBe(0)
  })
})

describe('buttonRowWidth', () => {
  it('counts gaps between buttons, not after them', () => {
    expect(buttonRowWidth(1)).toBe(TOUCH_TARGET)
    expect(buttonRowWidth(2)).toBe(2 * TOUCH_TARGET + 2)
  })

  it('is zero for no buttons', () => {
    expect(buttonRowWidth(0)).toBe(0)
  })
})

describe('secondaryRowFits', () => {
  it('could fit the secondary controls on a 360px phone', () => {
    expect(secondaryRowFits(SMALL_PHONE)).toBe(true)
  })

  it('could fit them on a 390px phone', () => {
    expect(secondaryRowFits(IPHONE_PRO)).toBe(true)
  })

  it('has room to spare at 360, not a hairline', () => {
    const spare = mobileRowWidth(SMALL_PHONE) - buttonRowWidth(6)
    // One scrollbar or one rounding difference must not clip a control.
    expect(spare).toBeGreaterThanOrEqual(24)
  })

  it('has a ceiling, so the budget is not a rubber stamp', () => {
    // What would catch a future control being added without re-checking. The
    // exact ceiling matters less than there being one: these live in the More
    // sheet's grid now, which wraps, rather than a single row that overflows.
    expect(secondaryRowFits(SMALL_PHONE, SECONDARY_CONTROL_COUNT)).toBe(true)
    expect(secondaryRowFits(SMALL_PHONE, SECONDARY_CONTROL_COUNT + 4)).toBe(
      false,
    )
  })

  it('would not have fitted six in the old grid half-width track', () => {
    // The row was impossible before because the centring grid handed the
    // controls one `minmax(0,1fr)` track of a three-track layout.
    expect(secondaryRowFits(SMALL_PHONE / 2)).toBe(false)
  })
})

describe('primaryRowFits', () => {
  it('fits the five controls and separated Leave on a 360px phone', () => {
    expect(primaryRowFits(SMALL_PHONE)).toBe(true)
  })

  it('fits down to 320px now that host actions are in More', () => {
    expect(primaryRowFits(320)).toBe(true)
    expect(primaryRowWidth()).toBeLessThanOrEqual(mobileRowWidth(320))
  })

  it('includes the destructive separation in what it needs', () => {
    expect(primaryRowWidth()).toBeGreaterThanOrEqual(
      4 * TOUCH_TARGET + DESTRUCTIVE_SEPARATION,
    )
  })
})

describe('controlBarFits', () => {
  it('holds at both target viewports, in the hardest role', () => {
    expect(controlBarFits(SMALL_PHONE)).toBe(true)
    expect(controlBarFits(IPHONE_PRO)).toBe(true)
  })

  it('reports honestly on a viewport that genuinely cannot carry it', () => {
    expect(controlBarFits(240)).toBe(false)
  })
})

/**
 * The second row is not free. The identity block was taken off its own row
 * precisely because ~34px of a 640px viewport mattered, so the height this
 * spends is a budget, not an afterthought.
 */
describe('portrait height budget', () => {
  it('leaves the stage at least four fifths of a 360x640 phone', () => {
    expect(portraitStageIsUsable(640)).toBe(true)
    expect(portraitStageFraction(640)).toBeGreaterThanOrEqual(0.8)
  })

  it('leaves the stage more of a 390x844 phone', () => {
    expect(portraitStageIsUsable(844)).toBe(true)
    expect(portraitStageFraction(844)).toBeGreaterThan(
      portraitStageFraction(640),
    )
  })

  it('budgets for labels, padding, and the border', () => {
    expect(mobileBarHeight()).toBe(MOBILE_CONTROL_HEIGHT + 20 + 1)
    expect(mobileBarHeight()).toBeLessThan(2 * TOUCH_TARGET + 24)
  })

  it('keeps four fifths of the stage even with a home-indicator inset', () => {
    expect(mobileBarHeight(34)).toBe(119)
    expect(portraitStageIsUsable(640, 34)).toBe(true)
  })

  it('reports honestly on a viewport too short for the bar to be a bar', () => {
    // A landscape phone in a 200px-tall window: this is not a claim that
    // everything always fits.
    expect(portraitStageIsUsable(200)).toBe(false)
  })

  it('treats an unmeasured viewport as having no stage rather than dividing by zero', () => {
    expect(portraitStageFraction(0)).toBe(0)
  })
})
