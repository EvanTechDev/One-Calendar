import { mock as moduleMock } from 'bun:test'
import { beforeEach, describe, expect, it, vi } from 'bun:test'
import { drizzleOperatorsMock, getFakeDb } from '../../api/route-test-db'

const originalModule1 = { ...(await import('drizzle-orm')) }
moduleMock.module('drizzle-orm', async () => {
  const actual = originalModule1
  return { ...actual, ...drizzleOperatorsMock }
})

moduleMock.module('@/lib/drizzle/client', () => ({
  getDb: () => getFakeDb().db,
}))

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
