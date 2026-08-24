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
 * An exception row holds two facts: the organiser's visibility override and
 * the participant's answer. A visibility change may delete a row only when it
 * carries no answer — otherwise the row is kept and only `visible` moves. See
 * ADR-0014 (a visibility change never destroys an RSVP).
 */
function hasAnswer(exception: OccurrenceException): boolean {
  return exception.status !== undefined && exception.status !== 'pending'
}

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
    // Hidden exceptions at or after the new baseline would contradict it.
    // Rows carrying an answer are flipped visible instead of deleted — the
    // upsert path preserves `status` (ADR-0014).
    const contradicting = exceptions.filter(
      (e) => !e.visible && e.recurrenceId >= stamp,
    )
    return {
      createInvite,
      baseline: { baselineKind: 'all', fromStamp: stamp, untilStamp: null },
      upsertExceptions: contradicting
        .filter(hasAnswer)
        .map((e) => ({ recurrenceId: e.recurrenceId, visible: true })),
      deleteExceptionStamps: contradicting
        .filter((e) => !hasAnswer(e))
        .map((e) => e.recurrenceId),
      revokeInvite: false,
    }
  }

  return {
    createInvite,
    baseline: { baselineKind: 'all', fromStamp: null, untilStamp: null },
    // The whole series is visible, so an exception can only duplicate or
    // contradict the baseline — for VISIBILITY. The same rows also hold the
    // participant's answers, so only answerless rows may be deleted; a hidden
    // row with an answer becomes visible again and the answer still counts
    // (ADR-0014).
    upsertExceptions: exceptions
      .filter((e) => hasAnswer(e) && !e.visible)
      .map((e) => ({ recurrenceId: e.recurrenceId, visible: true })),
    deleteExceptionStamps: exceptions
      .filter((e) => !hasAnswer(e))
      .map((e) => e.recurrenceId),
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

    // Visible exceptions from here onward would survive the cap otherwise.
    // Rows carrying an answer are hidden rather than deleted, so a participant
    // removed and later re-added finds their history intact (ADR-0014).
    const affected = exceptions.filter((e) => e.recurrenceId >= stamp)

    const keptExceptions = exceptions.filter(
      (e) => e.recurrenceId < stamp && e.visible,
    )
    // The invite must survive while any answer does — only a true revocation
    // may cascade an RSVP away.
    const answersSurvive = exceptions.some(hasAnswer)
    const emptied =
      isEmptyBaseline(nextBaseline) &&
      keptExceptions.length === 0 &&
      !answersSurvive

    return {
      createInvite: false,
      baseline: nextBaseline,
      upsertExceptions: affected
        .filter((e) => hasAnswer(e) && e.visible)
        .map((e) => ({ recurrenceId: e.recurrenceId, visible: false })),
      deleteExceptionStamps: affected
        .filter((e) => !hasAnswer(e))
        .map((e) => e.recurrenceId),
      revokeInvite: emptied,
    }
  }

  // `all`: the participant loses sight of the entire series. Answers are kept
  // on hidden rows and the invite survives to hold them; the invite is only
  // revoked outright when no answer would be lost with it (ADR-0014).
  const answersSurvive = exceptions.some(hasAnswer)
  return {
    createInvite: false,
    baseline: { baselineKind: 'none', fromStamp: null, untilStamp: null },
    upsertExceptions: exceptions
      .filter((e) => hasAnswer(e) && e.visible)
      .map((e) => ({ recurrenceId: e.recurrenceId, visible: false })),
    deleteExceptionStamps: exceptions
      .filter((e) => !hasAnswer(e))
      .map((e) => e.recurrenceId),
    revokeInvite: !answersSurvive,
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
