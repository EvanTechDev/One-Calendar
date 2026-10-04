// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.hoisted(() => {
  process.env.RESEND_API_KEY = 're_test_only_not_a_real_key'
})
import {
  cancelEmail,
  scheduleEmail,
  scheduledEmailStatus,
} from '@/lib/email/send-scheduled-email'

afterEach(() => vi.unstubAllGlobals())

describe('scheduled email provider adapter', () => {
  it('sends the persisted idempotency key and a bounded request through the real SDK', async () => {
    const fetch = vi.fn(
      async (_url: unknown, _options?: RequestInit) =>
        new Response(JSON.stringify({ id: 'mail-id' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetch)
    expect(
      await scheduleEmail({
        from: 'Calendar <test@example.com>',
        to: 'recipient@example.com',
        subject: 'Meeting',
        html: '<p>Meeting</p>',
        scheduledAt: new Date('2030-01-02T09:00:00Z'),
        idempotencyKey: 'reminder/stable-receipt',
      }),
    ).toBe('mail-id')
    const options = fetch.mock.calls[0][1]!
    expect(new Headers(options.headers).get('Idempotency-Key')).toBe(
      'reminder/stable-receipt',
    )
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(options.body as string)).toMatchObject({
      from: 'Calendar <test@example.com>',
      scheduled_at: '2030-01-02T09:00:00.000Z',
    })
  })

  it('keeps provider failures uncertain rather than pretending cancellation succeeded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network unavailable')
      }),
    )
    expect(await cancelEmail('mail-id')).toBe(false)
    expect(await scheduledEmailStatus('mail-id')).toBe('unknown')
  })
})
