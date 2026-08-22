// @vitest-environment node
/**
 * ADR-0006: a participant must never receive the recurrence rule. Holding the
 * rule lets a client generate occurrences that were never granted, so the
 * boundary is structural rather than a matter of client behaviour.
 *
 * These tests read the participant-facing source and assert the withholding is
 * still in place. A source-level check is deliberate: the alternative is
 * standing up the full events route against a database, and the property being
 * protected ("this response shape has no rrule") is exactly the kind of thing a
 * well-meaning refactor silently reverses.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const APP_ROOT = join(__dirname, '../../../../apps/calendar')

function read(relative: string): string {
  return readFileSync(join(APP_ROOT, relative), 'utf8')
}

describe('getSharedEvents', () => {
  const source = read('app/api/events/route.ts')

  it('nulls the rrule on every occurrence it emits to a participant', () => {
    // The emitted object literal must set rrule: null.
    expect(source).toMatch(/rrule: null,\s*\n\s*exdate: null,/)
  })

  it('sends a human-readable summary instead', () => {
    expect(source).toContain('describeRecurrence')
    expect(source).toContain('recurrenceSummary')
  })

  it('filters occurrences through the shared visibility rule', () => {
    expect(source).toContain('canParticipantSeeOccurrence')
  })
})

describe('the public invite endpoint', () => {
  const source = read('app/api/invite/[token]/route.ts')

  it('never returns event.rrule', () => {
    // The response builds `event: { ... }` explicitly; rrule must not appear as
    // a returned property.
    expect(source).not.toMatch(/\brrule:\s*event\.rrule/)
    expect(source).not.toMatch(/\brrule,/)
  })

  it('returns a recurrence summary and the granted occurrences only', () => {
    expect(source).toContain('recurrenceSummary')
    expect(source).toContain('canParticipantSeeOccurrence')
  })

  it('stays anonymous — no session lookup', () => {
    // Plan 012's invariant: the invite link is credential-bearing, not
    // session-bearing.
    expect(source).not.toContain('getAuthedUser')
    expect(source).not.toContain('getServerSession')
  })

  it('rejects an RSVP for an occurrence the token cannot see', () => {
    expect(source).toContain("{ error: 'Occurrence not found' }")
  })
})

describe('the invite page', () => {
  const source = read('app/(app)/invite/[token]/page.tsx')

  it('has no rrule in its data contract', () => {
    // Strip comments first: the word appears in a comment explaining its own
    // absence, and asserting on prose would be brittle either way.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/^\s*\*.*$/gm, '')
    expect(code).not.toContain('rrule')
  })

  it('sends the occurrence stamp when answering', () => {
    expect(source).toContain('recurrenceId')
  })
})
