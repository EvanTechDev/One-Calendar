import { describe, expect, it } from 'vitest'
import {
  canParticipantSeeOccurrence,
  planParticipantChange,
  rsvpForOccurrence,
  isEmptyBaseline,
  visibleStamps,
  ParticipantScopeError,
  type InviteVisibility,
  type OccurrenceException,
} from '@/lib/invites/visibility'

// A daily series starting 1 Aug, timed. Stamps are lexicographically ordered,
// so string comparison is chronological.
const DAY1 = '20260801T090000Z'
const DAY2 = '20260802T090000Z'
const DAY3 = '20260803T090000Z'
const DAY4 = '20260804T090000Z'
const DAY5 = '20260805T090000Z'

const WHOLE_SERIES: InviteVisibility = {
  baselineKind: 'all',
  fromStamp: DAY1,
  untilStamp: null,
}
const NO_BASELINE: InviteVisibility = {
  baselineKind: 'none',
  fromStamp: null,
  untilStamp: null,
}

describe('canParticipantSeeOccurrence', () => {
  it('admits every occurrence of an unbounded baseline', () => {
    for (const stamp of [DAY1, DAY2, DAY5]) {
      expect(canParticipantSeeOccurrence(WHOLE_SERIES, [], stamp)).toBe(true)
    }
  })

  it('refuses everything when the baseline is empty', () => {
    // The case that must never be confusable with "unbounded".
    for (const stamp of [DAY1, DAY3, DAY5]) {
      expect(canParticipantSeeOccurrence(NO_BASELINE, [], stamp)).toBe(false)
    }
  })

  it('excludes occurrences before fromStamp', () => {
    const invite: InviteVisibility = {
      baselineKind: 'all',
      fromStamp: DAY3,
      untilStamp: null,
    }
    expect(canParticipantSeeOccurrence(invite, [], DAY2)).toBe(false)
    expect(canParticipantSeeOccurrence(invite, [], DAY3)).toBe(true)
  })

  it('treats untilStamp as exclusive', () => {
    const invite: InviteVisibility = {
      baselineKind: 'all',
      fromStamp: DAY1,
      untilStamp: DAY3,
    }
    expect(canParticipantSeeOccurrence(invite, [], DAY2)).toBe(true)
    expect(canParticipantSeeOccurrence(invite, [], DAY3)).toBe(false)
  })

  it('lets a visible exception override an empty baseline', () => {
    const exceptions: OccurrenceException[] = [
      { recurrenceId: DAY3, visible: true },
    ]
    expect(canParticipantSeeOccurrence(NO_BASELINE, exceptions, DAY3)).toBe(
      true,
    )
    expect(canParticipantSeeOccurrence(NO_BASELINE, exceptions, DAY4)).toBe(
      false,
    )
  })

  it('lets a hidden exception override an admitting baseline', () => {
    const exceptions: OccurrenceException[] = [
      { recurrenceId: DAY2, visible: false },
    ]
    expect(canParticipantSeeOccurrence(WHOLE_SERIES, exceptions, DAY2)).toBe(
      false,
    )
    expect(canParticipantSeeOccurrence(WHOLE_SERIES, exceptions, DAY3)).toBe(
      true,
    )
  })

  it('never enumerates an unbounded series', () => {
    // A stamp centuries out is decided by comparison, not expansion.
    expect(
      canParticipantSeeOccurrence(WHOLE_SERIES, [], '99991231T090000Z'),
    ).toBe(true)
  })
})

describe("the issue's worked scenario", () => {
  // Day 1: add a/b/c with `all`.
  // Day 2: remove c with `following`.
  // Day 3: add c back with `single`.
  // Expected: c sees day 1 and day 3 only, keeps the original token, and gets
  // no second invitation email.
  it('walks day 1 → day 2 → day 3 for participant c', () => {
    const addAll = planParticipantChange(
      {
        stamp: DAY1,
        scope: 'all',
        firstStamp: DAY1,
        invite: null,
        exceptions: [],
      },
      'add',
    )
    expect(addAll.createInvite).toBe(true) // first invite, one email
    expect(addAll.baseline).toEqual({
      baselineKind: 'all',
      fromStamp: null,
      untilStamp: null,
    })

    let invite = addAll.baseline!
    let exceptions: OccurrenceException[] = []
    for (const stamp of [DAY1, DAY2, DAY3, DAY4]) {
      expect(canParticipantSeeOccurrence(invite, exceptions, stamp)).toBe(true)
    }

    const removeFollowing = planParticipantChange(
      {
        stamp: DAY2,
        scope: 'following',
        firstStamp: DAY1,
        invite,
        exceptions,
      },
      'remove',
    )
    expect(removeFollowing.createInvite).toBe(false)
    invite = removeFollowing.baseline!

    expect(canParticipantSeeOccurrence(invite, exceptions, DAY1)).toBe(true)
    expect(canParticipantSeeOccurrence(invite, exceptions, DAY2)).toBe(false)
    expect(canParticipantSeeOccurrence(invite, exceptions, DAY3)).toBe(false)
    expect(canParticipantSeeOccurrence(invite, exceptions, DAY4)).toBe(false)

    const addBackSingle = planParticipantChange(
      { stamp: DAY3, scope: 'single', firstStamp: DAY1, invite, exceptions },
      'add',
    )
    // The crux: no new invite, so no new token and no second email.
    expect(addBackSingle.createInvite).toBe(false)
    expect(addBackSingle.baseline).toBeNull()
    expect(addBackSingle.upsertExceptions).toEqual([
      { recurrenceId: DAY3, visible: true },
    ])

    exceptions = [...exceptions, ...addBackSingle.upsertExceptions]

    expect(canParticipantSeeOccurrence(invite, exceptions, DAY1)).toBe(true)
    expect(canParticipantSeeOccurrence(invite, exceptions, DAY2)).toBe(false)
    expect(canParticipantSeeOccurrence(invite, exceptions, DAY3)).toBe(true)
    expect(canParticipantSeeOccurrence(invite, exceptions, DAY4)).toBe(false)
  })

  it('keeps day 1 and day 3 RSVPs independent', () => {
    // Two occurrences one participant can see must never share an RSVP.
    const exceptions: OccurrenceException[] = [
      { recurrenceId: DAY1, visible: true, status: 'accepted' },
      { recurrenceId: DAY3, visible: true },
    ]
    expect(rsvpForOccurrence(exceptions, DAY1)).toBe('accepted')
    expect(rsvpForOccurrence(exceptions, DAY3)).toBe('pending')
  })
})

describe('planParticipantChange — add', () => {
  it('gives a never-invited participant an exceptions-only baseline at single scope', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY3,
        scope: 'single',
        firstStamp: DAY1,
        invite: null,
        exceptions: [],
      },
      'add',
    )
    expect(plan.createInvite).toBe(true)
    // Must be an empty baseline, never an unbounded one.
    expect(plan.baseline).toEqual(NO_BASELINE)
    expect(plan.upsertExceptions).toEqual([
      { recurrenceId: DAY3, visible: true },
    ])

    const invite = plan.baseline!
    expect(
      canParticipantSeeOccurrence(invite, plan.upsertExceptions, DAY3),
    ).toBe(true)
    expect(
      canParticipantSeeOccurrence(invite, plan.upsertExceptions, DAY1),
    ).toBe(false)
    expect(
      canParticipantSeeOccurrence(invite, plan.upsertExceptions, DAY4),
    ).toBe(false)
  })

  it('extends the baseline from the stamp at following scope', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY3,
        scope: 'following',
        firstStamp: DAY1,
        invite: NO_BASELINE,
        exceptions: [],
      },
      'add',
    )
    expect(plan.baseline).toEqual({
      baselineKind: 'all',
      fromStamp: DAY3,
      untilStamp: null,
    })
    expect(canParticipantSeeOccurrence(plan.baseline!, [], DAY2)).toBe(false)
    expect(canParticipantSeeOccurrence(plan.baseline!, [], DAY5)).toBe(true)
  })

  it('clears contradicting hidden exceptions when extending at following scope', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY2,
        scope: 'following',
        firstStamp: DAY1,
        invite: NO_BASELINE,
        exceptions: [
          { recurrenceId: DAY1, visible: false },
          { recurrenceId: DAY3, visible: false },
        ],
      },
      'add',
    )
    // DAY3 contradicts the new baseline; DAY1 is outside it and stays.
    expect(plan.deleteExceptionStamps).toEqual([DAY3])
  })

  it('clears all exceptions at all scope', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY1,
        scope: 'all',
        firstStamp: DAY1,
        invite: NO_BASELINE,
        exceptions: [{ recurrenceId: DAY3, visible: true }],
      },
      'add',
    )
    expect(plan.baseline).toEqual({
      baselineKind: 'all',
      fromStamp: null,
      untilStamp: null,
    })
    expect(plan.deleteExceptionStamps).toEqual([DAY3])
  })

  it('rejects all scope away from the first occurrence', () => {
    expect(() =>
      planParticipantChange(
        {
          stamp: DAY3,
          scope: 'all',
          firstStamp: DAY1,
          invite: null,
          exceptions: [],
        },
        'add',
      ),
    ).toThrow(ParticipantScopeError)
  })

  it('allows all scope on the first occurrence', () => {
    expect(() =>
      planParticipantChange(
        {
          stamp: DAY1,
          scope: 'all',
          firstStamp: DAY1,
          invite: null,
          exceptions: [],
        },
        'add',
      ),
    ).not.toThrow()
  })
})

describe('planParticipantChange — remove', () => {
  it('hides exactly one occurrence at single scope', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY2,
        scope: 'single',
        firstStamp: DAY1,
        invite: WHOLE_SERIES,
        exceptions: [],
      },
      'remove',
    )
    expect(plan.baseline).toBeNull()
    expect(plan.upsertExceptions).toEqual([
      { recurrenceId: DAY2, visible: false },
    ])
    expect(plan.revokeInvite).toBe(false)
  })

  it('caps the baseline at following scope', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY3,
        scope: 'following',
        firstStamp: DAY1,
        invite: WHOLE_SERIES,
        exceptions: [],
      },
      'remove',
    )
    expect(plan.baseline).toEqual({
      baselineKind: 'all',
      fromStamp: DAY1,
      untilStamp: DAY3,
    })
  })

  it('only ever narrows an already-capped baseline', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY4,
        scope: 'following',
        firstStamp: DAY1,
        invite: {
          baselineKind: 'all',
          fromStamp: DAY1,
          untilStamp: DAY2,
        },
        exceptions: [],
      },
      'remove',
    )
    // Removing later must not re-open days 2–3.
    expect(plan.baseline?.untilStamp).toBe(DAY2)
  })

  it('drops visible exceptions at or after a following-removal', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY3,
        scope: 'following',
        firstStamp: DAY1,
        invite: WHOLE_SERIES,
        exceptions: [
          { recurrenceId: DAY2, visible: true },
          { recurrenceId: DAY4, visible: true },
        ],
      },
      'remove',
    )
    expect(plan.deleteExceptionStamps).toEqual([DAY4])
  })

  it('revokes when a following-removal leaves nothing visible', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY1,
        scope: 'following',
        firstStamp: DAY1,
        invite: WHOLE_SERIES,
        exceptions: [],
      },
      'remove',
    )
    expect(plan.revokeInvite).toBe(true)
  })

  it('empties the baseline at all scope', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY1,
        scope: 'all',
        firstStamp: DAY1,
        invite: WHOLE_SERIES,
        exceptions: [{ recurrenceId: DAY3, visible: true }],
      },
      'remove',
    )
    expect(plan.baseline).toEqual(NO_BASELINE)
    expect(plan.deleteExceptionStamps).toEqual([DAY3])
    expect(plan.revokeInvite).toBe(true)
  })

  it('is a no-op for a participant who was never invited', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY2,
        scope: 'single',
        firstStamp: DAY1,
        invite: null,
        exceptions: [],
      },
      'remove',
    )
    expect(plan.upsertExceptions).toEqual([])
    expect(plan.revokeInvite).toBe(false)
  })
})

describe('non-recurring events', () => {
  it('grants the whole event on add', () => {
    const plan = planParticipantChange(
      {
        stamp: null,
        scope: 'single',
        firstStamp: null,
        invite: null,
        exceptions: [],
      },
      'add',
    )
    expect(plan.createInvite).toBe(true)
    expect(plan.baseline).toEqual({
      baselineKind: 'all',
      fromStamp: null,
      untilStamp: null,
    })
  })

  it('revokes on remove', () => {
    const plan = planParticipantChange(
      {
        stamp: null,
        scope: 'single',
        firstStamp: null,
        invite: WHOLE_SERIES,
        exceptions: [],
      },
      'remove',
    )
    expect(plan.revokeInvite).toBe(true)
  })
})

describe('isEmptyBaseline', () => {
  it('is true for kind none', () => {
    expect(isEmptyBaseline(NO_BASELINE)).toBe(true)
  })

  it('is false for an unbounded range', () => {
    expect(isEmptyBaseline(WHOLE_SERIES)).toBe(false)
  })

  it('is true for a collapsed range', () => {
    expect(
      isEmptyBaseline({
        baselineKind: 'all',
        fromStamp: DAY3,
        untilStamp: DAY3,
      }),
    ).toBe(true)
  })
})

describe('visibleStamps', () => {
  it('filters an expansion down to the granted slice', () => {
    const invite: InviteVisibility = {
      baselineKind: 'all',
      fromStamp: DAY1,
      untilStamp: DAY2,
    }
    const exceptions: OccurrenceException[] = [
      { recurrenceId: DAY3, visible: true },
    ]
    expect(
      visibleStamps(invite, exceptions, [DAY1, DAY2, DAY3, DAY4, DAY5]),
    ).toEqual([DAY1, DAY3])
  })
})
