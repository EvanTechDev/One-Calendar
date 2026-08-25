/**
 * The event editor's Meeting lifecycle.
 *
 * "Add Zentra Meet" used to only *stage* an intent, and the room was created
 * when the event was saved — so the organiser could not copy a link until after
 * saving. It is now created on click (Google Calendar's behaviour, which
 * ADR-0018 makes this integration's default), which moves the whole difficulty
 * into cleanup. The table this pins:
 *
 * | Session                                          | On close                    |
 * | ------------------------------------------------ | --------------------------- |
 * | new event, meeting added, NOT saved              | provisional row deleted     |
 * | new event, meeting added, saved                  | nothing (the save commits)  |
 * | EXISTING event whose meeting was already saved   | NOTHING — data loss guard   |
 * | existing event, meeting added this session, no save | provisional row deleted  |
 * | tab killed                                       | no code runs; ADR-0018 sweep|
 *
 * The last row is why a provisional row carries an expiry at all, and is
 * verified in tests/meetings/provisional-meetings.test.ts — no client-side test
 * can assert what happens when the client stops existing.
 *
 * `event-editor.tsx` cannot be rendered under jsdom (Radix popover +
 * useLiveAnchorRect loop forever), which is why this lifecycle lives in a hook
 * that can be.
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

const { useEventMeetingDraft } = await import('@/hooks/use-event-meeting-draft')

interface Call {
  url: string
  method: string
  body: Record<string, unknown> | undefined
}

const calls: Call[] = []
let nextId = 0
let postOk = true

beforeEach(() => {
  calls.length = 0
  nextId = 0
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
      if ((init?.method ?? 'GET') === 'POST') {
        nextId += 1
        const id = `aaaa-${String(nextId).padStart(4, '0')}`
        return {
          ok: postOk,
          status: postOk ? 200 : 500,
          json: async () => ({
            meeting: { id, url: `https://meet.test/${id}` },
          }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) }
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const posts = () => calls.filter((c) => c.method === 'POST')
const deletes = () => calls.filter((c) => c.method === 'DELETE')

type Props = {
  eventId: string | null
  existing: { id: string; url: string } | null
  isNew: boolean
  open: boolean
}

function renderDraft(props: Props) {
  return renderHook(
    ({ eventId, existing, isNew, open }: Props) =>
      useEventMeetingDraft(eventId, existing, isNew, open),
    { initialProps: props },
  )
}

const NEW_DRAFT: Props = {
  eventId: 'draft-1',
  existing: null,
  isNew: true,
  open: true,
}

describe('creating the meeting immediately', () => {
  it('creates the room on click, before any save, and exposes its link', async () => {
    const { result } = renderDraft(NEW_DRAFT)

    await act(async () => {
      await result.current.add()
    })

    expect(posts()).toEqual([
      {
        url: '/api/meetings',
        method: 'POST',
        // `provisional` says the event does not exist yet, so the server gives
        // the row an expiry rather than 404-ing on the missing event.
        body: { eventId: 'draft-1', provisional: true },
      },
    ])
    expect(result.current.meeting).toEqual({
      id: 'aaaa-0001',
      url: 'https://meet.test/aaaa-0001',
    })
  })

  it('creates a NON-provisional room for an event that already exists', async () => {
    const { result } = renderDraft({ ...NEW_DRAFT, isNew: false })

    await act(async () => {
      await result.current.add()
    })

    expect(posts()[0]!.body).toEqual({
      eventId: 'draft-1',
      provisional: false,
    })
  })

  it('reports a failed creation and shows no link', async () => {
    postOk = false
    const { result } = renderDraft(NEW_DRAFT)

    await act(async () => {
      await result.current.add()
    })

    expect(toastError).toHaveBeenCalledWith('Could not add the meeting')
    expect(result.current.meeting).toBeNull()
  })

  it('surfaces a meeting the event already had, with no request', async () => {
    const { result } = renderDraft({
      ...NEW_DRAFT,
      isNew: false,
      existing: { id: 'bbbb-2222', url: 'https://meet.test/bbbb-2222' },
    })

    expect(result.current.meeting).toEqual({
      id: 'bbbb-2222',
      url: 'https://meet.test/bbbb-2222',
    })
    expect(calls).toHaveLength(0)
  })
})

describe('closing the editor', () => {
  it('deletes the provisional room of a NEW event that was never saved', async () => {
    const { result, rerender } = renderDraft(NEW_DRAFT)

    await act(async () => {
      await result.current.add()
    })
    await act(async () => {
      rerender({ ...NEW_DRAFT, open: false })
    })

    await waitFor(() => expect(deletes()).toHaveLength(1))
    expect(deletes()[0]!.body).toEqual({
      eventId: 'draft-1',
      provisional: true,
    })
  })

  it('does NOT delete an existing event\u2019s already-saved meeting', async () => {
    // The single most important correctness property here. Opening an event that
    // has had a meeting for weeks and pressing Escape must not destroy the link
    // its participants hold.
    const { rerender } = renderDraft({
      eventId: 'evt-saved',
      existing: { id: 'cccc-3333', url: 'https://meet.test/cccc-3333' },
      isNew: false,
      open: true,
    })

    await act(async () => {
      rerender({
        eventId: 'evt-saved',
        existing: { id: 'cccc-3333', url: 'https://meet.test/cccc-3333' },
        isNew: false,
        open: false,
      })
    })

    // Not "a DELETE that the server refuses" — no DELETE at all.
    expect(calls).toHaveLength(0)
  })

  it('does NOT delete a meeting added this session to an EXISTING event', async () => {
    // An existing event's meeting is committed the moment it is created, so it
    // is a real Event Meeting from that instant and the close leaves it alone.
    // (Removing it is the X button's job, not the close's.)
    const existing: Props = {
      eventId: 'evt-saved',
      existing: null,
      isNew: false,
      open: true,
    }
    const { result, rerender } = renderDraft(existing)

    await act(async () => {
      await result.current.add()
    })
    await act(async () => {
      rerender({ ...existing, open: false })
    })

    expect(deletes()).toHaveLength(0)
  })

  it('deletes nothing when no meeting was created', async () => {
    const { rerender } = renderDraft(NEW_DRAFT)

    await act(async () => {
      rerender({ ...NEW_DRAFT, open: false })
    })

    expect(calls).toHaveLength(0)
  })

  it('keeps the room when the editor closes BECAUSE it saved', async () => {
    // Saving closes the editor, so the save has to disarm the cleanup or the two
    // race and the dismissal deletes the meeting the save was committing.
    const { result, rerender } = renderDraft(NEW_DRAFT)

    await act(async () => {
      await result.current.add()
    })
    act(() => result.current.keep())
    await act(async () => {
      rerender({ ...NEW_DRAFT, open: false })
    })

    expect(deletes()).toHaveLength(0)
  })

  it('targets the event the meeting was created for, not a later one', async () => {
    const { result, rerender } = renderDraft(NEW_DRAFT)

    await act(async () => {
      await result.current.add()
    })
    // The editor mints a fresh draft id on close; cleanup must still name the id
    // the room actually points at.
    await act(async () => {
      rerender({ ...NEW_DRAFT, eventId: 'draft-2', open: false })
    })

    await waitFor(() => expect(deletes()).toHaveLength(1))
    expect(deletes()[0]!.body).toMatchObject({ eventId: 'draft-1' })
  })
})

describe('add \u2192 close \u2192 add does not leak rows', () => {
  it('cleans up the first room and creates exactly one more', async () => {
    const { result, rerender } = renderDraft(NEW_DRAFT)

    await act(async () => {
      await result.current.add()
    })
    await act(async () => {
      rerender({ ...NEW_DRAFT, open: false })
    })
    await waitFor(() => expect(deletes()).toHaveLength(1))

    // A second draft session, under the fresh id the editor mints.
    const second: Props = { ...NEW_DRAFT, eventId: 'draft-2' }
    await act(async () => {
      rerender(second)
    })
    await act(async () => {
      await result.current.add()
    })

    expect(posts()).toHaveLength(2)
    expect(posts()[1]!.body).toEqual({
      eventId: 'draft-2',
      provisional: true,
    })
    // One row created, one deleted, one live — no leak.
    expect(deletes()).toHaveLength(1)
  })

  it('does not carry the previous session\u2019s room into the next editor', async () => {
    const { result, rerender } = renderDraft(NEW_DRAFT)

    await act(async () => {
      await result.current.add()
    })
    expect(result.current.meeting).not.toBeNull()

    await act(async () => {
      rerender({ ...NEW_DRAFT, open: false })
    })
    await act(async () => {
      rerender({ ...NEW_DRAFT, eventId: 'draft-2', open: true })
    })

    // A fresh draft showing the abandoned draft's link would be a lie: that row
    // is being deleted.
    expect(result.current.meeting).toBeNull()
  })

  it('is idempotent against a double-click', async () => {
    const { result } = renderDraft(NEW_DRAFT)

    await act(async () => {
      // Both fired before either settles — `busy` is what stops the second.
      await Promise.all([result.current.add(), result.current.add()])
    })

    expect(posts()).toHaveLength(1)
  })
})

describe('removing the meeting explicitly', () => {
  it('deletes the room and disarms the close cleanup', async () => {
    const { result, rerender } = renderDraft(NEW_DRAFT)

    await act(async () => {
      await result.current.add()
    })
    await act(async () => {
      await result.current.remove()
    })

    expect(deletes()).toHaveLength(1)
    expect(result.current.meeting).toBeNull()

    await act(async () => {
      rerender({ ...NEW_DRAFT, open: false })
    })
    // A second DELETE for a row that is already gone would be pointless noise.
    expect(deletes()).toHaveLength(1)
  })

  it('removes an existing event\u2019s committed meeting outright', async () => {
    const { result } = renderDraft({
      eventId: 'evt-saved',
      existing: { id: 'cccc-3333', url: 'https://meet.test/cccc-3333' },
      isNew: false,
      open: true,
    })

    await act(async () => {
      await result.current.remove()
    })

    // NOT provisional: the organiser is deliberately ending the arrangement, so
    // the committed row goes too. This is the one path that may.
    expect(deletes()[0]!.body).toEqual({
      eventId: 'evt-saved',
      provisional: false,
    })
  })
})
