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

describe('a visibility change never destroys an RSVP (ADR-0014)', () => {
  // The organiser's visibility operations and the participant's answers live
  // in the same exception rows. Deleting a row for a visibility reason used to
  // delete the answer with it — silently, in the exact "remove c on day 2, add
  // c back on day 3" flow the feature was built for.

  it('widening to all scope keeps an answered exception, only flipping it visible', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY1,
        scope: 'all',
        firstStamp: DAY1,
        invite: NO_BASELINE,
        exceptions: [
          { recurrenceId: DAY3, visible: true, status: 'accepted' },
          { recurrenceId: DAY4, visible: true },
        ],
      },
      'add',
    )
    // DAY4 carries no answer and may go; DAY3's accepted must survive.
    expect(plan.deleteExceptionStamps).toEqual([DAY4])
    expect(plan.upsertExceptions).toEqual([])
  })

  it('restores an answer hidden by a single-removal when widened back to all', () => {
    // c answered accepted for day 3, the organiser hid day 3 (the upsert path
    // keeps the status on the hidden row), then widened c to the whole series.
    // The answer was given and never retracted, so it counts again.
    const plan = planParticipantChange(
      {
        stamp: DAY1,
        scope: 'all',
        firstStamp: DAY1,
        invite: WHOLE_SERIES,
        exceptions: [
          { recurrenceId: DAY3, visible: false, status: 'accepted' },
        ],
      },
      'add',
    )
    expect(plan.deleteExceptionStamps).toEqual([])
    expect(plan.upsertExceptions).toEqual([
      { recurrenceId: DAY3, visible: true },
    ])
  })

  it('following-add flips a hidden answered row visible instead of deleting it', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY2,
        scope: 'following',
        firstStamp: DAY1,
        invite: NO_BASELINE,
        exceptions: [
          { recurrenceId: DAY3, visible: false, status: 'declined' },
          { recurrenceId: DAY4, visible: false },
        ],
      },
      'add',
    )
    expect(plan.deleteExceptionStamps).toEqual([DAY4])
    expect(plan.upsertExceptions).toEqual([
      { recurrenceId: DAY3, visible: true },
    ])
  })

  it('following-removal hides answered rows instead of deleting them', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY3,
        scope: 'following',
        firstStamp: DAY1,
        invite: WHOLE_SERIES,
        exceptions: [
          { recurrenceId: DAY3, visible: true, status: 'accepted' },
          { recurrenceId: DAY4, visible: true },
        ],
      },
      'remove',
    )
    // DAY4 (no answer) is deleted; DAY3's answer survives on a hidden row.
    expect(plan.deleteExceptionStamps).toEqual([DAY4])
    expect(plan.upsertExceptions).toEqual([
      { recurrenceId: DAY3, visible: false },
    ])
    // Visibility is still removed, whatever happens to the rows.
    expect(plan.baseline?.untilStamp).toBe(DAY3)
  })

  it('all-removal keeps the invite alive to hold surviving answers', () => {
    const plan = planParticipantChange(
      {
        stamp: DAY1,
        scope: 'all',
        firstStamp: DAY1,
        invite: WHOLE_SERIES,
        exceptions: [{ recurrenceId: DAY2, visible: true, status: 'maybe' }],
      },
      'remove',
    )
    expect(plan.baseline).toEqual(NO_BASELINE)
    expect(plan.upsertExceptions).toEqual([
      { recurrenceId: DAY2, visible: false },
    ])
    expect(plan.deleteExceptionStamps).toEqual([])
    // Revoking would cascade the answer away; the grant must stay.
    expect(plan.revokeInvite).toBe(false)
  })

  it('all-removal with no answers still revokes outright', () => {
    // Without answers there is nothing to preserve, so the old behaviour —
    // full revocation — is correct and keeps the table clean.
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
    expect(plan.revokeInvite).toBe(true)
    expect(plan.deleteExceptionStamps).toEqual([DAY3])
  })

  it('remove-then-re-add round-trips the answer, whatever the removal scope', () => {
    // The asymmetry this rule closes: the outcome of "remove, then re-add"
    // must not depend on whether the organiser picked single or following.
    const answered: OccurrenceException[] = [
      { recurrenceId: DAY3, visible: true, status: 'accepted' },
    ]

    for (const scope of ['following', 'all'] as const) {
      const removal = planParticipantChange(
        {
          stamp: scope === 'all' ? DAY1 : DAY3,
          scope,
          firstStamp: DAY1,
          invite: WHOLE_SERIES,
          exceptions: answered,
        },
        'remove',
      )
      expect(removal.revokeInvite).toBe(false)

      // Apply the removal to get the post-removal exception state.
      const afterRemoval: OccurrenceException[] = answered
        .filter((e) => !removal.deleteExceptionStamps.includes(e.recurrenceId))
        .map((e) => {
          const upsert = removal.upsertExceptions.find(
            (u) => u.recurrenceId === e.recurrenceId,
          )
          return upsert ? { ...e, visible: upsert.visible } : e
        })
      // Hidden but preserved.
      expect(rsvpForOccurrence(afterRemoval, DAY3)).toBe('accepted')
      expect(
        canParticipantSeeOccurrence(removal.baseline!, afterRemoval, DAY3),
      ).toBe(false)

      const readd = planParticipantChange(
        {
          stamp: DAY1,
          scope: 'all',
          firstStamp: DAY1,
          invite: removal.baseline,
          exceptions: afterRemoval,
        },
        'add',
      )
      const afterReadd: OccurrenceException[] = afterRemoval
        .filter((e) => !readd.deleteExceptionStamps.includes(e.recurrenceId))
        .map((e) => {
          const upsert = readd.upsertExceptions.find(
            (u) => u.recurrenceId === e.recurrenceId,
          )
          return upsert ? { ...e, visible: upsert.visible } : e
        })
      // Visible again, answer intact.
      expect(
        canParticipantSeeOccurrence(readd.baseline!, afterReadd, DAY3),
      ).toBe(true)
      expect(rsvpForOccurrence(afterReadd, DAY3)).toBe('accepted')
    }
  })
})
