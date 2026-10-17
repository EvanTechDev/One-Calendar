import { describe, expect, it } from 'vitest'
import { getHorizontalPopoverPlacement } from '@zntr/ui/calendar/lib/popover-placement'

describe('getHorizontalPopoverPlacement', () => {
  it('opens right when the full popover fits', () => {
    expect(
      getHorizontalPopoverPlacement({ left: 100, right: 140 }, 500),
    ).toEqual({ side: 'right', anchorX: 140 })
  })

  it('anchors to the target’s left edge when only the left side fits', () => {
    expect(
      getHorizontalPopoverPlacement({ left: 450, right: 490 }, 800),
    ).toEqual({ side: 'left', anchorX: 450 })
  })

  it('chooses the side with more room when neither side fits completely', () => {
    expect(
      getHorizontalPopoverPlacement({ left: 300, right: 340 }, 600),
    ).toEqual({ side: 'left', anchorX: 300 })
  })
})
