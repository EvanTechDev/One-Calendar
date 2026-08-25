import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  cleanup,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react'
import { MeetingHistory } from '@/components/dashboard/meeting-history'
import type { MeetingRow } from '@/components/dashboard/meeting-history'

/**
 * The reported problem: chat history is recorded but search is "not finished" —
 * a result showed only a room code and a date, so a name or chat-phrase query
 * gave no indication of why the row was there. Also asserted here: the search
 * runs without hunting for a button, can be cleared, and never presents a room
 * that simply never stored chat as a failure (ADR 0020).
 */

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const rows: MeetingRow[] = [
  {
    id: 'ab3k-x9q2',
    createdAt: '2026-08-20T09:00:00.000Z',
    endedAt: '2026-08-20T10:00:00.000Z',
    eventTitle: null,
    totalMinutes: 60,
    attendees: 3,
  },
  {
    id: 'zz11-yy22',
    createdAt: '2026-08-19T09:00:00.000Z',
    endedAt: null,
    eventTitle: 'Weekly sync',
    totalMinutes: 0,
    attendees: 0,
  },
]

const chatHit: MeetingRow = {
  ...rows[0]!,
  matches: [
    { kind: 'attendee', name: 'Priya Raman' },
    { kind: 'chat', sender: 'Sam', message: 'the budget is approved, ship it' },
  ],
}

function respondWith(meetings: MeetingRow[]) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ meetings }), {
        headers: { 'Content-Type': 'application/json' },
      }),
  )
}

beforeEach(() => {
  cleanup()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.stubGlobal('fetch', respondWith([chatHit]))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Types a whole query, one keystroke at a time. */
function type(text: string) {
  const input = screen.getByLabelText('Search meetings')
  for (let end = 1; end <= text.length; end += 1) {
    fireEvent.change(input, { target: { value: text.slice(0, end) } })
  }
}

/** Waits out the debounce. */
async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(400)
  })
}

describe('MeetingHistory search', () => {
  it('searches without needing a button pressed', async () => {
    render(<MeetingHistory rows={rows} />)

    type('budget')
    await settle()

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/dashboard/search?q=budget'),
    )
    // No submit button to hunt for any more.
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull()
  })

  it('waits for more than one character before asking the server', async () => {
    render(<MeetingHistory rows={rows} />)

    type('b')
    await settle()

    // One character matches most of a history — it costs a request to say
    // nothing useful.
    expect(fetch).not.toHaveBeenCalled()
  })

  it('debounces a burst of typing into one request', async () => {
    render(<MeetingHistory rows={rows} />)

    type('budget')
    await settle()

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  })

  it('shows the attendee and the chat line that matched', async () => {
    render(<MeetingHistory rows={rows} />)

    type('budget')
    await settle()

    // The whole point: the row now says why it is here.
    expect(await screen.findByText('Priya Raman')).toBeInTheDocument()
    expect(screen.getByText('Sam:')).toBeInTheDocument()
    expect(screen.getByText(/is approved, ship it/)).toBeInTheDocument()
  })

  it('marks the matched term inside the chat line', async () => {
    const { container } = render(<MeetingHistory rows={rows} />)

    type('budget')
    await settle()

    await waitFor(() => {
      const marks = Array.from(container.querySelectorAll('mark')).map(
        (node) => node.textContent,
      )
      expect(marks).toContain('budget')
    })
  })

  it('clears back to the full list', async () => {
    render(<MeetingHistory rows={rows} />)

    type('budget')
    await settle()
    await screen.findByText('Priya Raman')
    // The searched-away row is gone while the search is showing.
    expect(screen.queryByText('zz11-yy22')).toBeNull()

    fireEvent.click(screen.getByLabelText('Clear search'))

    // Deleting the input by hand was previously the only way out.
    expect(screen.getByLabelText('Search meetings')).toHaveValue('')
    expect(screen.getByText('zz11-yy22')).toBeInTheDocument()
    expect(screen.queryByText('Priya Raman')).toBeNull()
  })

  it('offers no clear affordance until there is something to clear', () => {
    render(<MeetingHistory rows={rows} />)
    expect(screen.queryByLabelText('Clear search')).toBeNull()
  })

  it('explains an empty result instead of implying a broken search', async () => {
    vi.stubGlobal('fetch', respondWith([]))
    render(<MeetingHistory rows={rows} />)

    type('nothing')
    await settle()

    expect(await screen.findByText(/No meeting matched/)).toBeInTheDocument()
    // ADR 0020: an encrypted meeting never stores chat, so a phrase from one is
    // unfindable by design — that is a stated limit, not a failure.
    expect(
      screen.getByText(/Encrypted meetings never save chat/),
    ).toBeInTheDocument()
  })

  it('states the searchable fields honestly, without claiming event titles', async () => {
    vi.stubGlobal('fetch', respondWith([]))
    render(<MeetingHistory rows={rows} />)

    type('nothing')
    await settle()

    const note = await screen.findByText(/Codes, attendee names/)
    // The calendar encrypts titles at rest, so a LIKE would match ciphertext.
    expect(note.textContent).toMatch(/event titles are encrypted at rest/)
  })

  it('reports a failed search in place of the list, with a retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    )
    render(<MeetingHistory rows={rows} />)

    type('budget')
    await settle()

    // A toast alone left an empty list behind, which reads as "nothing matched".
    expect(await screen.findByText('Search could not run.')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument()
  })

  it('drops a deleted row from the search results too', async () => {
    const deleteFetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (init?.method === 'DELETE') return new Response('{}')
      return new Response(JSON.stringify({ meetings: [chatHit] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', deleteFetch)
    render(<MeetingHistory rows={rows} />)

    type('budget')
    await settle()
    await screen.findByText('Priya Raman')

    fireEvent.click(screen.getByLabelText('Delete ab3k-x9q2'))

    // The row is gone server-side, so leaving it in `results` meant a
    // re-search could bring back a meeting that no longer exists.
    await waitFor(() => expect(screen.queryByText('ab3k-x9q2')).toBeNull())
  })

  it('adds no match line when only the room code matched', async () => {
    // Nothing to explain: the code is already the row's heading.
    vi.stubGlobal(
      'fetch',
      respondWith([{ ...rows[0]!, matches: [{ kind: 'code' }] }]),
    )
    const { container } = render(<MeetingHistory rows={rows} />)

    type('ab3k')
    await settle()

    await waitFor(() =>
      expect(screen.getByText('ab3k-x9q2')).toBeInTheDocument(),
    )
    expect(container.querySelectorAll('mark')).toHaveLength(0)
  })

  it('ignores a slow earlier response once a later one has landed', async () => {
    const slow = new Response(
      JSON.stringify({ meetings: [{ ...rows[1]!, matches: [] }] }),
      { headers: { 'Content-Type': 'application/json' } },
    )
    let firstResolve: ((value: Response) => void) | undefined
    const staged = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (firstResolve = resolve)),
      )
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ meetings: [chatHit] }), {
            headers: { 'Content-Type': 'application/json' },
          }),
      )
    vi.stubGlobal('fetch', staged)
    render(<MeetingHistory rows={rows} />)

    type('bu')
    await settle()
    type('budget')
    await settle()
    await screen.findByText('Priya Raman')

    // The stale request lands last; its results must not replace the current
    // ones.
    await act(async () => {
      firstResolve?.(slow)
    })
    expect(screen.getByText('Priya Raman')).toBeInTheDocument()
  })
})
