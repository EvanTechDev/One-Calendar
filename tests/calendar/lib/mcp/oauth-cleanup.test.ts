// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzleOperatorsMock, getFakeDb } from '../../api/route-test-db'

vi.mock('drizzle-orm', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return { ...actual, ...drizzleOperatorsMock }
})

vi.mock('@/lib/drizzle/client', () => ({ getDb: () => getFakeDb().db }))

const { cleanupExpiredOAuthState } = await import('@/lib/mcp/oauth-cleanup')

beforeEach(() => {
  getFakeDb().reset()
})

describe('OAuth state cleanup', () => {
  it('deletes expired transient records and preserves live ones', async () => {
    const now = new Date('2026-08-27T12:00:00Z')
    getFakeDb().seed(
      { id: 'device-old', expiresAt: new Date('2026-08-27T11:59:00Z') },
      'deviceCode',
    )
    getFakeDb().seed(
      { id: 'device-live', expiresAt: new Date('2026-08-27T12:01:00Z') },
      'deviceCode',
    )
    getFakeDb().seed(
      { id: 'assertion-old', expiresAt: new Date('2026-08-27T11:59:00Z') },
      'oauthClientAssertion',
    )

    await expect(cleanupExpiredOAuthState(now)).resolves.toEqual({
      deviceCodes: 1,
      clientAssertions: 1,
    })
    expect(getFakeDb().row('device-live', 'deviceCode')).toBeDefined()
    expect(getFakeDb().row('device-old', 'deviceCode')).toBeUndefined()
  })
})
