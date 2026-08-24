// @vitest-environment node
/**
 * The top-up cron is an unauthenticated HTTP endpoint guarded only by
 * CRON_SECRET, so its auth is the whole security story. It also must be safe to
 * run twice, since Vercel can retry.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const reconcile = vi.hoisted(() => ({
  reconcileEventReminders: vi.fn(async () => ({ scheduled: 1, cancelled: 0 })),
  pruneSpentReminders: vi.fn(async () => 0),
}))

vi.mock('@/lib/reminders/reconcile', () => reconcile)

const events: Array<Record<string, unknown>> = []

vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(events),
      }),
    }),
  }),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: () => () => true,
    and: () => () => true,
    isNotNull: () => () => true,
  }
})

import { GET } from '@/app/api/reminders/topup/route'

function request(token?: string): Request {
  return new Request('http://localhost/api/reminders/topup', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

beforeEach(() => {
  events.length = 0
  reconcile.reconcileEventReminders.mockClear()
  reconcile.pruneSpentReminders.mockClear()
  process.env.CRON_SECRET = 'correct-horse'
})

describe('GET /api/reminders/topup', () => {
  it('rejects a request with no token', async () => {
    const res = await GET(request())
    expect(res.status).toBe(401)
    expect(reconcile.reconcileEventReminders).not.toHaveBeenCalled()
  })

  it('rejects a wrong token', async () => {
    const res = await GET(request('wrong'))
    expect(res.status).toBe(401)
  })

  it('rejects everything when CRON_SECRET is unset', async () => {
    // Fail closed: an unset secret must not mean "no auth required".
    delete process.env.CRON_SECRET
    const res = await GET(request('anything'))
    expect(res.status).toBe(401)
  })

  it('accepts the correct token', async () => {
    const res = await GET(request('correct-horse'))
    expect(res.status).toBe(200)
  })

  it('reconciles each eligible event', async () => {
    events.push({ id: 'e1', userId: 'u1' }, { id: 'e2', userId: 'u1' })
    const res = await GET(request('correct-horse'))
    const body = await res.json()
    expect(reconcile.reconcileEventReminders).toHaveBeenCalledTimes(2)
    expect(body.events).toBe(2)
    expect(body.scheduled).toBe(2)
  })

  it('never refuses loudly on quota — it retries tomorrow', async () => {
    events.push({ id: 'e1', userId: 'u1' })
    await GET(request('correct-horse'))
    expect(reconcile.reconcileEventReminders).toHaveBeenCalledWith(
      expect.objectContaining({ strictQuota: false }),
    )
  })

  it('keeps going when one event fails', async () => {
    events.push({ id: 'e1', userId: 'u1' }, { id: 'e2', userId: 'u1' })
    reconcile.reconcileEventReminders.mockRejectedValueOnce(
      new Error('provider down'),
    )
    const res = await GET(request('correct-horse'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.failed).toBe(1)
    expect(body.scheduled).toBe(1)
  })

  it('prunes spent rows', async () => {
    reconcile.pruneSpentReminders.mockResolvedValue(3)
    const res = await GET(request('correct-horse'))
    expect((await res.json()).pruned).toBe(3)
  })

  it('is safe to run twice', async () => {
    // Idempotence lives in reconcileEventReminders (covered in its own tests);
    // here we only assert the route adds no extra state of its own.
    events.push({ id: 'e1', userId: 'u1' })
    const first = await GET(request('correct-horse'))
    const second = await GET(request('correct-horse'))
    expect(await first.json()).toEqual(await second.json())
  })
})
