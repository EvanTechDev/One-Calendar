import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { HAND_RAISED_ATTRIBUTE } from '@/lib/room-signals'

/**
 * "The hand goes up and then cannot be put down" was two bugs stacked.
 *
 * 1. `handRaised` was read off `localParticipant.attributes`, and an attribute
 *    change does not re-render — so it stayed false after the raise and every
 *    later click took the raise branch again.
 * 2. Lowering deleted the key from the map it sent. `setAttributes` "will make
 *    updates only to keys that are present", so an absent key leaves the old
 *    value standing on the server.
 *
 * Both are asserted through what reaches `setAttributes`, because that is the
 * only thing the server sees.
 */
const participant = {
  attributes: {} as Record<string, string>,
  name: 'Ada',
  identity: 'ada',
  setAttributes: vi.fn(async (next: Record<string, string>) => {
    // Mirrors the documented server behaviour: present keys are applied, absent
    // keys are left alone. A test that replaced the whole map would pass even
    // with the delete-the-key bug in place.
    Object.assign(participant.attributes, next)
  }),
}

// Whatever the subscription would report, driven by the fake's own state so the
// hook sees the same value the server holds.
vi.mock('@livekit/components-react', () => ({
  useLocalParticipant: () => ({ localParticipant: participant }),
  useParticipantAttribute: (key: string) => participant.attributes[key],
  useDataChannel: () => ({ send: vi.fn() }),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { useRoomSignals } = await import('@/hooks/use-room-signals')

beforeEach(() => {
  participant.attributes = {}
  participant.setAttributes.mockClear()
})

describe('useRoomSignals raise hand', () => {
  it('raises a hand with a timestamp, so the queue has an order', async () => {
    const { result } = renderHook(() => useRoomSignals())

    await act(async () => {
      await result.current.toggleHand()
    })

    const sent = participant.setAttributes.mock.calls[0]?.[0] ?? {}
    expect(Number(sent[HAND_RAISED_ATTRIBUTE])).toBeGreaterThan(0)
  })

  it('reports the hand as raised after raising it', async () => {
    const { result, rerender } = renderHook(() => useRoomSignals())

    await act(async () => {
      await result.current.toggleHand()
    })
    rerender()

    // This is the state that stayed false and made the button a no-op.
    expect(result.current.handRaised).toBe(true)
  })

  it('lowers the hand on the second press', async () => {
    const { result, rerender } = renderHook(() => useRoomSignals())

    await act(async () => {
      await result.current.toggleHand()
    })
    rerender()
    await act(async () => {
      await result.current.toggleHand()
    })
    rerender()

    expect(result.current.handRaised).toBe(false)
  })

  it('sends the key explicitly when lowering, not an omission', async () => {
    participant.attributes = { [HAND_RAISED_ATTRIBUTE]: '1700000000000' }
    const { result } = renderHook(() => useRoomSignals())

    await act(async () => {
      await result.current.toggleHand()
    })

    const sent = participant.setAttributes.mock.calls[0]?.[0] ?? {}
    // The key must be PRESENT and empty. Absent means "leave it as it was",
    // which is exactly why the hand stayed up.
    expect(Object.hasOwn(sent, HAND_RAISED_ATTRIBUTE)).toBe(true)
    expect(sent[HAND_RAISED_ATTRIBUTE]).toBe('')
  })

  it('leaves other attributes alone', async () => {
    participant.attributes = { somethingElse: 'keep me' }
    const { result } = renderHook(() => useRoomSignals())

    await act(async () => {
      await result.current.toggleHand()
    })

    expect(participant.attributes.somethingElse).toBe('keep me')
    // Only the hand key is sent; echoing the whole map back risks writing a
    // stale copy of an attribute someone else owns.
    const sent = participant.setAttributes.mock.calls[0]?.[0] ?? {}
    expect(Object.keys(sent)).toEqual([HAND_RAISED_ATTRIBUTE])
  })

  it('survives a rejected write without wedging the state', async () => {
    participant.setAttributes.mockRejectedValueOnce(new Error('no permission'))
    const { result, rerender } = renderHook(() => useRoomSignals())

    await act(async () => {
      await result.current.toggleHand()
    })
    rerender()

    // The server refused, so the hand is still down — and a later press must
    // still be able to try again.
    expect(result.current.handRaised).toBe(false)
  })
})
