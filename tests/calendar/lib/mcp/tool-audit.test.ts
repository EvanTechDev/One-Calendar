/**
 * Pins the per-tool-call audit summarisation (CORE-128).
 *
 * The critical property is that the audit log records WHAT changed without
 * copying user content into it: the settings page exposes these rows, so a
 * leaked event title or participant email here is a privacy regression, not a
 * cosmetic one.
 */
import { describe, it, expect } from 'vitest'
import { summarizeChanges } from '@/lib/mcp/tool-audit'

describe('summarizeChanges', () => {
  it('returns nothing for read-only tools', () => {
    expect(
      summarizeChanges('list_events', { query: 'standup' }),
    ).toBeUndefined()
    expect(summarizeChanges('get_event', { event_id: 'e1' })).toBeUndefined()
    expect(summarizeChanges('get_profile', {})).toBeUndefined()
  })

  it('lists changed field NAMES for a mutation', () => {
    const summary = summarizeChanges('update_event', {
      event_id: 'evt-1',
      title: 'Quarterly board review',
      start_date: '2026-08-12T11:30:00Z',
    })
    expect(summary?.fields).toEqual(['start_date', 'title'])
  })

  it('never stores user content values', () => {
    const secret = 'Quarterly board review with acme@example.com'
    const summary = summarizeChanges('update_event', {
      event_id: 'evt-1',
      title: secret,
      description: 'Discuss the acquisition',
      location: '221B Baker Street',
    })
    const serialized = JSON.stringify(summary)
    expect(serialized).not.toContain(secret)
    expect(serialized).not.toContain('acquisition')
    expect(serialized).not.toContain('Baker Street')
    // Only the field names survive.
    expect(summary?.fields).toEqual(['description', 'location', 'title'])
  })

  it('excludes addressing and pagination params from the field list', () => {
    const summary = summarizeChanges('update_event', {
      event_id: 'evt-1',
      page: 2,
      limit: 20,
      fields: ['title'],
      title: 'x',
    })
    expect(summary?.fields).toEqual(['title'])
  })

  it('keeps the recurrence scope verbatim: it says how many occurrences changed', () => {
    const summary = summarizeChanges('update_event', {
      event_id: 'evt-1',
      title: 'x',
      apply_to: 'following',
    })
    expect(summary?.apply_to).toBe('following')
  })

  it('records counts rather than participant addresses', () => {
    const summary = summarizeChanges('add_event_participants', {
      event_id: 'evt-1',
      emails: ['a@example.com', 'b@example.com'],
    })
    expect(summary?.emailCount).toBe(2)
    expect(JSON.stringify(summary)).not.toContain('example.com')
  })

  it('flags a recurrence rule change without storing the rule', () => {
    const summary = summarizeChanges('update_event', {
      event_id: 'evt-1',
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
      exdate: ['20260817T113000Z', '20260824T113000Z'],
    })
    expect(summary?.rruleChanged).toBe(true)
    expect(summary?.exdateCount).toBe(2)
    expect(JSON.stringify(summary)).not.toContain('BYDAY')
  })

  it('ignores params that were not supplied', () => {
    const summary = summarizeChanges('update_event', {
      event_id: 'evt-1',
      title: 'x',
      location: undefined,
    })
    expect(summary?.fields).toEqual(['title'])
  })

  it('returns undefined when a mutation carried no content fields', () => {
    // delete_event only addresses a resource; there is nothing to describe.
    expect(
      summarizeChanges('delete_event', { event_id: 'evt-1' }),
    ).toBeUndefined()
  })

  it('still reports the scope for a scoped delete', () => {
    const summary = summarizeChanges('delete_event', {
      event_id: 'evt-1',
      apply_to: 'all',
    })
    expect(summary?.apply_to).toBe('all')
  })
})
