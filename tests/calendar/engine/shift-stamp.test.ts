import { describe, expect, it } from 'vitest'
import { shiftStamp } from '@/lib/recurrence/engine'

describe('shiftStamp', () => {
  it('shifts a timed stamp by a full delta', () => {
    expect(shiftStamp('20260817T090000Z', 3_600_000)).toBe('20260817T100000Z')
  })

  it('shifts across a day boundary', () => {
    expect(shiftStamp('20260817T233000Z', 3_600_000)).toBe('20260818T003000Z')
  })

  it('shifts an all-day stamp by whole days', () => {
    expect(shiftStamp('20260817', 2 * 86_400_000)).toBe('20260819')
  })

  it('shifts a negative delta', () => {
    expect(shiftStamp('20260817T090000Z', -3_600_000)).toBe('20260817T080000Z')
  })
})
