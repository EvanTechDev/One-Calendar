/**
 * The deferred "Add Zentra Meet" intent on a draft event. Two bugs pinned:
 *
 * 1. BUG-01 — the meeting POST fired alongside the event insert rather than
 *    after it, so `POST /api/meetings` usually reached the server before the
 *    event row existed and answered 404. The call was also `void fetch(...)
 *    .catch(() => {})`, so `response.ok` was never checked and the organiser
 *    was told nothing at all.
 * 2. BUG-06 — the intent was never cleared. Arming it on a draft, dismissing
 *    without saving, then creating an unrelated event silently attached a
 *    meeting to the wrong one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
    warning: vi.fn(),
  },
}))

const { usePendingMeeting } = await import('@/hooks/use-pending-meeting')

interface Call {
  url: string
  method: string
  body: unknown
}

const calls: Call[] = []
let postOk = true

beforeEach(() => {
  calls.length = 0
  postOk = true
  toastError.mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      })
      return { ok: postOk, status: postOk ? 200 : 404, json: async () => ({}) }
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('usePendingMeeting', () => {
  it('does nothing when the intent was never armed', async () => {
    const { result } = renderHook(() => usePendingMeeting(true))
    await act(async () => {
      await result.current.attach('evt-1')
    })
    expect(calls).toHaveLength(0)
  })

  it('waits for the event write to settle before POSTing the meeting', async () => {
    const order: string[] = []
    let finishWrite: () => void = () => {}
    const write = new Promise<void>((resolve) => {
      finishWrite = () => {
        order.push('event-written')
        resolve()
      }
    })

    const { result } = renderHook(() => usePendingMeeting(true))
    act(() => result.current.setPending(true))

    let attached: Promise<void>
    act(() => {
      attached = result.current.attach('evt-1', write)
    })

    // The race: without awaiting the write, the POST would already be out.
    expect(calls).toHaveLength(0)

    finishWrite()
    await act(async () => {
      await attached!
    })

    order.push('meeting-posted')
    expect(order).toEqual(['event-written', 'meeting-posted'])
    expect(calls).toEqual([
      {
        url: '/api/meetings',
        method: 'POST',
        body: { eventId: 'evt-1' },
      },
    ])
  })

  it('surfaces a failed attachment instead of swallowing it', async () => {
    postOk = false
    const { result } = renderHook(() => usePendingMeeting(true))
    act(() => result.current.setPending(true))

    await act(async () => {
      await result.current.attach('evt-1', Promise.resolve())
    })

    expect(toastError).toHaveBeenCalledWith(
      'The event saved, but the meeting could not be added',
    )
  })

  it('does not fail the save when the event write itself rejects', async () => {
    const { result } = renderHook(() => usePendingMeeting(true))
    act(() => result.current.setPending(true))

    await act(async () => {
      await expect(
        result.current.attach('evt-1', Promise.reject(new Error('boom'))),
      ).resolves.toBeUndefined()
    })
    // No meeting for an event that never saved.
    expect(calls).toHaveLength(0)
    expect(toastError).toHaveBeenCalled()
  })

  it('disarms the intent when the editor closes (BUG-06)', async () => {
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => usePendingMeeting(open),
      { initialProps: { open: true } },
    )

    act(() => result.current.setPending(true))
    expect(result.current.pending).toBe(true)

    // Dismissed without saving.
    rerender({ open: false })
    await waitFor(() => expect(result.current.pending).toBe(false))

    // A fresh, unrelated draft must NOT inherit the intent.
    rerender({ open: true })
    expect(result.current.pending).toBe(false)

    await act(async () => {
      await result.current.attach('evt-unrelated', Promise.resolve())
    })
    expect(calls).toHaveLength(0)
  })

  it('attaches only once per armed intent', async () => {
    const { result } = renderHook(() => usePendingMeeting(true))
    act(() => result.current.setPending(true))

    await act(async () => {
      await result.current.attach('evt-1', Promise.resolve())
    })
    expect(calls).toHaveLength(1)

    // A second save of the same editor session must not mint another room.
    await act(async () => {
      await result.current.attach('evt-1', Promise.resolve())
    })
    expect(calls).toHaveLength(1)
  })
})
