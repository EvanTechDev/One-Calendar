// @vitest-environment node
/**
 * describeRecurrence must work in a route handler.
 *
 * It used to read `translations` from `@zntr/i18n/calendar`, whose underlying
 * module is `'use client'` — so the export was undefined on the server and this
 * threw "Cannot read properties of undefined (reading 'recurrenceEveryDays')".
 * Only client components called it until the invite/shared-event work started
 * describing recurrence server-side.
 *
 * The `node` environment above is the point of this file: the rest of the engine
 * suite runs in jsdom, which masked the problem.
 */
import { describe, it, expect } from 'vitest'
import { describeRecurrence } from '@/lib/recurrence/engine'

describe('describeRecurrence in a server environment', () => {
  it('describes a daily rule', () => {
    expect(describeRecurrence('FREQ=DAILY', false)).toBeTruthy()
  })

  it('describes an interval rule without leaking "undefined"', () => {
    // This is the exact path that threw: interval > 1 reads
    // t.recurrenceEveryDays.
    const out = describeRecurrence('FREQ=DAILY;INTERVAL=3', false)
    expect(out).not.toContain('undefined')
    expect(out).toMatch(/3/)
  })

  it('covers every frequency at interval > 1', () => {
    for (const freq of ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']) {
      const out = describeRecurrence(`FREQ=${freq};INTERVAL=2`, false)
      expect(out, freq).not.toContain('undefined')
    }
  })

  it('describes the rule the invite page actually sends', () => {
    const out = describeRecurrence('FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU', false)
    expect(out).not.toContain('undefined')
    expect(out).toBeTruthy()
  })

  it('handles UNTIL and COUNT suffixes', () => {
    expect(
      describeRecurrence('FREQ=DAILY;UNTIL=20260826T090000Z', false),
    ).not.toContain('undefined')
    expect(describeRecurrence('FREQ=DAILY;COUNT=5', false)).not.toContain(
      'undefined',
    )
  })

  it('handles BYSETPOS and BYMONTHDAY', () => {
    expect(
      describeRecurrence('FREQ=MONTHLY;BYDAY=MO;BYSETPOS=-1', false),
    ).not.toContain('undefined')
    expect(
      describeRecurrence('FREQ=MONTHLY;BYMONTHDAY=-1', false),
    ).not.toContain('undefined')
  })

  it('works in Chinese too', () => {
    const out = describeRecurrence('FREQ=DAILY;INTERVAL=3', true)
    expect(out).not.toContain('undefined')
    expect(out).toBeTruthy()
  })

  it('returns the raw rule for an unparseable input', () => {
    expect(describeRecurrence('NOT A RULE', false)).toBe('NOT A RULE')
  })
})
