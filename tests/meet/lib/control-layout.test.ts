import { describe, expect, it } from 'vitest'
import {
  DESTRUCTIVE_SEPARATION,
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
  it('meets the 44px platform minimum', () => {
    // iOS's minimum, and the floor Android's 48dp rounds from. These controls
    // were 32px while six of them were also buried in a dropdown.
    expect(TOUCH_TARGET).toBeGreaterThanOrEqual(44)
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

  it('charges the Organiser for their End button', () => {
    // It shares the primary line, so pretending it is free is how a row
    // overflows for exactly one role.
    expect(mobileRowWidth(SMALL_PHONE, true)).toBeLessThan(
      mobileRowWidth(SMALL_PHONE, false),
    )
  })

  it('never reports a negative width for an absurd viewport', () => {
    expect(mobileRowWidth(10, true)).toBe(0)
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
  it('fits all six controls on a 360px phone', () => {
    // This is the whole justification for taking them out of the dropdown:
    // every one of them is now reachable in one tap.
    expect(secondaryRowFits(SMALL_PHONE)).toBe(true)
  })

  it('fits all six on a 390px phone', () => {
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
  it('fits mic, camera, details and a separated Leave on a 360px phone', () => {
    expect(primaryRowFits(SMALL_PHONE)).toBe(true)
  })

  it('fits them for an Organiser too, End button included', () => {
    expect(primaryRowFits(SMALL_PHONE, true)).toBe(true)
    expect(primaryRowFits(IPHONE_PRO, true)).toBe(true)
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

  it('spends one row of touch target, and says so', () => {
    // One row plus its padding — not a number guessed from a screenshot. The
    // two-row version cost 2 * TOUCH_TARGET + 24 = 112px to give six secondary
    // toggles the microphone's prominence; folding them behind More returns
    // 48px of a 640px viewport to the stage.
    expect(mobileBarHeight()).toBe(TOUCH_TARGET + 20)
    expect(mobileBarHeight()).toBeLessThan(2 * TOUCH_TARGET + 24)
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
