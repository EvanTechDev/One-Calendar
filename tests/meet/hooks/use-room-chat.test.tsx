import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

/**
 * The reported bug: "sometimes the message is sent but the other person does
 * not receive it". The recipient had chat closed — the panel owned `useChat`,
 * so closing it unmounted the hook and threw away both the history and
 * anything that arrived while it was shut.
 *
 * `useChat` is faked at module level so the test can deliver a message at a
 * chosen moment. The alias for `@livekit/components-react` in
 * apps/meet/vitest.config.ts is what makes this mock apply at all.
 */
const state = {
  messages: [] as { id: string; message: string; timestamp: number }[],
  sendToRoom: vi.fn(async () => {}),
}

vi.mock('@livekit/components-react', () => ({
  useChat: () => ({ chatMessages: state.messages, send: state.sendToRoom }),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { useRoomChat } = await import('@/hooks/use-room-chat')

function arrive(message: string) {
  state.messages = [
    ...state.messages,
    { id: `m${state.messages.length}`, message, timestamp: Date.now() },
  ]
}

const options = {
  roomName: 'abcd-efgh',
  retainMessages: true,
  participantToken: 'token',
}

beforeEach(() => {
  state.messages = []
  state.sendToRoom = vi.fn(async () => {})
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}')),
  )
})

describe('useRoomChat', () => {
  it('keeps a message that arrived while the panel was closed', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useRoomChat({ ...options, isOpen }),
      { initialProps: { isOpen: false } },
    )

    // The exact reported scenario: the recipient is not looking at chat.
    act(() => arrive('are you there?'))
    rerender({ isOpen: false })

    // Opening the panel must reveal it. Under the old design the panel mounted
    // fresh here and this was empty.
    rerender({ isOpen: true })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]?.message).toBe('are you there?')
  })

  it('counts messages that arrive while closed as unread', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useRoomChat({ ...options, isOpen }),
      { initialProps: { isOpen: false } },
    )

    act(() => arrive('first'))
    rerender({ isOpen: false })
    act(() => arrive('second'))
    rerender({ isOpen: false })

    expect(result.current.unread).toBe(2)
  })

  it('clears unread once the panel is open', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useRoomChat({ ...options, isOpen }),
      { initialProps: { isOpen: false } },
    )

    act(() => arrive('hello'))
    rerender({ isOpen: false })
    expect(result.current.unread).toBe(1)

    rerender({ isOpen: true })
    expect(result.current.unread).toBe(0)
  })

  it('does not count a message that arrives while the panel is open', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useRoomChat({ ...options, isOpen }),
      { initialProps: { isOpen: true } },
    )

    act(() => arrive('watched it land'))
    rerender({ isOpen: true })

    expect(result.current.unread).toBe(0)
  })

  it('keeps history across a close and reopen', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useRoomChat({ ...options, isOpen }),
      { initialProps: { isOpen: true } },
    )

    act(() => arrive('before'))
    rerender({ isOpen: true })
    rerender({ isOpen: false })
    rerender({ isOpen: true })

    expect(result.current.messages).toHaveLength(1)
  })

  it('retains a sent message when the room is not encrypted', async () => {
    const { result } = renderHook(() =>
      useRoomChat({ ...options, isOpen: true }),
    )

    await act(async () => {
      await result.current.send('saved please')
    })

    expect(state.sendToRoom).toHaveBeenCalledWith('saved please')
    expect(fetch).toHaveBeenCalledWith(
      '/api/meetings/abcd-efgh/chat',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('never retains in an encrypted room', async () => {
    // ADR 0020: the server would only ever see ciphertext, so retaining would
    // weaken the E2EE promise rather than provide history.
    const { result } = renderHook(() =>
      useRoomChat({ ...options, retainMessages: false, isOpen: true }),
    )

    await act(async () => {
      await result.current.send('secret')
    })

    expect(state.sendToRoom).toHaveBeenCalledWith('secret')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports a failed send so the draft is not cleared', async () => {
    state.sendToRoom = vi.fn(async () => {
      throw new Error('no transport')
    })
    const { result } = renderHook(() =>
      useRoomChat({ ...options, isOpen: true }),
    )

    let outcome: boolean | undefined
    await act(async () => {
      outcome = await result.current.send('lost')
    })

    expect(outcome).toBe(false)
    // A failed live send must not be retained either — that would persist a
    // message no one in the room ever saw.
    expect(fetch).not.toHaveBeenCalled()
  })
})
