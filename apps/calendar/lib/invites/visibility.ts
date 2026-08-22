import type { ApplyTo } from '@/lib/event-service'

/**
 * Participant visibility for a recurring series, and the plan for changing it.
 *
 * Pure — no database, no network. Every read path answers "may this participant
 * see this occurrence?" by calling `canParticipantSeeOccurrence` here, and every
 * write path goes through `planParticipantChange`. See
 * ADR-0005 (participant visibility is a baseline range plus per-stamp exceptions) and
 * ADR-0008 (visibility is decided in one place, shared by every reader).
 *
 * The model mirrors recurrence itself: a baseline range plus per-stamp
 * exceptions, exactly as a series is an rrule plus exdates plus overrides.
 */

export type BaselineKind = 'all' | 'none'

export type RsvpStatus = 'pending' | 'accepted' | 'maybe' | 'declined'

/** The access grant: one per participant per series, carrying a stable token. */
export interface InviteVisibility {
  /** `none` means "exceptions only" — never confuse it with unbounded. */
  baselineKind: BaselineKind
  /** Inclusive lower bound. Null with kind `all` means "from the beginning". */
  fromStamp: string | null
  /** Exclusive upper bound. Null with kind `all` means unbounded. */
  untilStamp: string | null
}

/** An explicit override of the baseline for one occurrence. */
export interface OccurrenceException {
  recurrenceId: string
  visible: boolean
  status?: RsvpStatus
}

/**
 * The single decision point. An exception for the stamp wins outright;
 * otherwise the baseline range decides.
 *
 * RFC stamps are lexicographically ordered for a given all-day/timed shape, so
 * string comparison is chronological comparison. Mixing shapes within one
 * series does not happen — a series is either all-day or timed throughout.
 */
export function canParticipantSeeOccurrence(
  invite: InviteVisibility,
  exceptions: readonly OccurrenceException[],
  stamp: string,
): boolean {
  const exception = exceptions.find((e) => e.recurrenceId === stamp)
  if (exception) return exception.visible

  if (invite.baselineKind === 'none') return false
  if (invite.fromStamp !== null && stamp < invite.fromStamp) return false
  if (invite.untilStamp !== null && stamp >= invite.untilStamp) return false
  return true
}

/** The RSVP for one occurrence. Independent per occurrence by construction. */
export function rsvpForOccurrence(
  exceptions: readonly OccurrenceException[],
  stamp: string,
): RsvpStatus {
  return exceptions.find((e) => e.recurrenceId === stamp)?.status ?? 'pending'
}

export interface ParticipantChangeInput {
  /** The occurrence the organiser is acting from. Null for a non-recurring event. */
  stamp: string | null
  scope: ApplyTo
  /** The series' first visible stamp, for the `all`-scope guard. */
  firstStamp: string | null
  /** Existing grant, or null when this participant has never been invited. */
  invite: InviteVisibility | null
  exceptions: readonly OccurrenceException[]
}

export interface ParticipantChangePlan {
  /**
   * True when no invite exists yet, so one must be created with a fresh token
   * and an invitation email. False means reuse the existing token and send
   * nothing — the "add back without re-inviting" requirement.
   */
  createInvite: boolean
  /** Null leaves the baseline untouched. */
  baseline: InviteVisibility | null
  /** Exception rows to insert or update. */
  upsertExceptions: OccurrenceException[]
  /** Stamps whose exception rows should be removed. */
  deleteExceptionStamps: string[]
  /** True when every remaining grant is empty, so the invite can be dropped. */
  revokeInvite: boolean
}

export class ParticipantScopeError extends Error {}

/**
 * Translate a scoped add/remove into writes.
 *
 * Scope semantics, per ADR-0007 (participant scope follows the same rules as event scope):
 *
 * | scope       | add                            | remove                          |
 * | ----------- | ------------------------------ | ------------------------------- |
 * | `all`       | baseline = whole series        | baseline emptied                |
 * | `following` | baseline extended from stamp   | baseline capped at stamp        |
 * | `single`    | one visible exception          | one hidden exception            |
 */
export function planParticipantChange(
  input: ParticipantChangeInput,
  action: 'add' | 'remove',
): ParticipantChangePlan {
  const { stamp, scope, firstStamp, invite, exceptions } = input

  // Non-recurring events have no stamps and no scope to speak of.
  if (stamp === null) {
    if (action === 'add') {
      return {
        createInvite: invite === null,
        baseline: { baselineKind: 'all', fromStamp: null, untilStamp: null },
        upsertExceptions: [],
        deleteExceptionStamps: [],
        revokeInvite: false,
      }
    }
    return {
      createInvite: false,
      baseline: null,
      upsertExceptions: [],
      deleteExceptionStamps: [],
      revokeInvite: true,
    }
  }

  // Mirrors the server-side guard on event edits: "all" is only well-defined
  // from the series' first occurrence.
  if (scope === 'all' && firstStamp !== null && stamp !== firstStamp) {
    throw new ParticipantScopeError(
      "apply_to 'all' is only allowed on the series' first occurrence",
    )
  }

  if (action === 'add') return planAdd(stamp, scope, invite, exceptions)
  return planRemove(stamp, scope, invite, exceptions)
}

function planAdd(
  stamp: string,
  scope: ApplyTo,
  invite: InviteVisibility | null,
  exceptions: readonly OccurrenceException[],
): ParticipantChangePlan {
  const createInvite = invite === null

  if (scope === 'single') {
    // Deliberately touches neither the baseline nor the token. A participant
    // added back at single scope after a following-removal reuses their
    // original link and receives no new email.
    return {
      createInvite,
      baseline: createInvite
        ? { baselineKind: 'none', fromStamp: null, untilStamp: null }
        : null,
      upsertExceptions: [{ recurrenceId: stamp, visible: true }],
      deleteExceptionStamps: [],
      revokeInvite: false,
    }
  }

  if (scope === 'following') {
    return {
      createInvite,
      baseline: { baselineKind: 'all', fromStamp: stamp, untilStamp: null },
      upsertExceptions: [],
      // Hidden exceptions at or after the new baseline would contradict it.
      deleteExceptionStamps: exceptions
        .filter((e) => !e.visible && e.recurrenceId >= stamp)
        .map((e) => e.recurrenceId),
      revokeInvite: false,
    }
  }

  return {
    createInvite,
    baseline: { baselineKind: 'all', fromStamp: null, untilStamp: null },
    upsertExceptions: [],
    // The whole series is visible, so no exception can add anything.
    deleteExceptionStamps: exceptions.map((e) => e.recurrenceId),
    revokeInvite: false,
  }
}

function planRemove(
  stamp: string,
  scope: ApplyTo,
  invite: InviteVisibility | null,
  exceptions: readonly OccurrenceException[],
): ParticipantChangePlan {
  // Nothing to remove.
  if (invite === null) {
    return {
      createInvite: false,
      baseline: null,
      upsertExceptions: [],
      deleteExceptionStamps: [],
      revokeInvite: false,
    }
  }

  if (scope === 'single') {
    return {
      createInvite: false,
      baseline: null,
      upsertExceptions: [{ recurrenceId: stamp, visible: false }],
      deleteExceptionStamps: [],
      revokeInvite: false,
    }
  }

  if (scope === 'following') {
    const nextBaseline: InviteVisibility =
      invite.baselineKind === 'none'
        ? invite
        : // Cap the baseline here. If it already ended earlier, keep the
          // earlier bound — this must only ever narrow.
          {
            baselineKind: 'all',
            fromStamp: invite.fromStamp,
            untilStamp:
              invite.untilStamp !== null && invite.untilStamp < stamp
                ? invite.untilStamp
                : stamp,
          }

    const keptExceptions = exceptions.filter(
      (e) => e.recurrenceId < stamp && e.visible,
    )
    const emptied = isEmptyBaseline(nextBaseline) && keptExceptions.length === 0

    return {
      createInvite: false,
      baseline: nextBaseline,
      upsertExceptions: [],
      // Visible exceptions from here onward would survive the cap otherwise.
      deleteExceptionStamps: exceptions
        .filter((e) => e.recurrenceId >= stamp)
        .map((e) => e.recurrenceId),
      revokeInvite: emptied,
    }
  }

  // `all`: the participant loses the entire series.
  return {
    createInvite: false,
    baseline: { baselineKind: 'none', fromStamp: null, untilStamp: null },
    upsertExceptions: [],
    deleteExceptionStamps: exceptions.map((e) => e.recurrenceId),
    revokeInvite: true,
  }
}

/** True when a baseline range can never admit an occurrence. */
export function isEmptyBaseline(invite: InviteVisibility): boolean {
  if (invite.baselineKind === 'none') return true
  if (invite.fromStamp === null || invite.untilStamp === null) return false
  return invite.untilStamp <= invite.fromStamp
}

/**
 * Filter expanded occurrence stamps down to those the participant may see.
 * The read paths use this so the filtering rule exists in exactly one place.
 */
export function visibleStamps(
  invite: InviteVisibility,
  exceptions: readonly OccurrenceException[],
  stamps: readonly string[],
): string[] {
  return stamps.filter((stamp) =>
    canParticipantSeeOccurrence(invite, exceptions, stamp),
  )
}
