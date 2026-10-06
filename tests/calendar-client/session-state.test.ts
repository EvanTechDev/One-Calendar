import { describe, expect, it } from 'vitest'
import { receiveSession } from '../../apps/calendar-client/src/session-state'
import type { SessionView } from '../../apps/calendar-client/src/native'

const signedIn: SessionView = {
  generation: 1,
  user: { id: 'first', name: 'First account', email: 'first@example.com' },
  expiresAt: '2026-10-08T00:00:00.000Z',
  pending: false,
  signingIn: false,
  error: null,
}

describe('desktop session IPC ordering', () => {
  it('keeps logout when an earlier refresh reply arrives late', () => {
    const signedOut = {
      ...signedIn,
      generation: 2,
      user: null,
      expiresAt: null,
    }
    const afterLogout = receiveSession(signedIn, signedOut)
    expect(receiveSession(afterLogout, signedIn).user).toBeNull()
  })

  it('keeps the new account when a previous account reply arrives late', () => {
    const switched = {
      ...signedIn,
      generation: 3,
      user: {
        id: 'second',
        name: 'Second account',
        email: 'second@example.com',
      },
    }
    const current = receiveSession(signedIn, switched)
    expect(receiveSession(current, signedIn).user?.id).toBe('second')
  })

  it('applies session refreshes within the current account generation', () => {
    const refreshing = { ...signedIn, pending: true }
    expect(receiveSession(refreshing, signedIn).pending).toBe(false)
  })
})
