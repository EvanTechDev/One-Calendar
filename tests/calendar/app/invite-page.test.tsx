/**
 * The invite page is the most visible surface of participant invitations, and
 * the `single` scope flow is the one ADR-0005 was built for.
 *
 * Three failures pinned here:
 *
 * 1. The headline rendered `event.startDate`/`endDate`, which the endpoint always
 *    sets from the MASTER row regardless of which occurrences the token grants.
 *    A participant granted exactly one occurrence was told to attend occurrence
 *    #1, which they cannot see.
 * 2. The occurrence picker rendered only when `occurrences.length > 1`, so that
 *    same participant got no picker and no way to see which date they were
 *    answering.
 * 3. A grant reduced to nothing (add at `single`, then remove at `single`) yields
 *    `occurrences: []`, which was indistinguishable from `null` (non-recurring):
 *    the page rendered as a one-off at the master's date and any RSVP was a
 *    guaranteed 400.
 * 4. `handleAddToCalendar` ignored the response and set `addedToCalendar` true
 *    unconditionally, so a refused add reported success and the button then
 *    disappeared — the participant could not retry.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { format } from 'date-fns'

/** The exact string the page renders for a timed date, in the ambient zone. */
function shown(iso: string): string {
  return format(new Date(iso), 'yyyy-MM-dd HH:mm')
}

vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'tok' }),
}))

import InvitePage from '@/app/(app)/invite/[token]/page'

type InvitePayload = Record<string, unknown>

const state = {
  payload: null as InvitePayload | null,
  patchStatus: 200,
  patchBody: {} as Record<string, unknown>,
  patches: [] as unknown[],
}

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    title: 'Weekend sync',
    description: null,
    location: null,
    // The MASTER row's dates, deliberately far from the granted occurrence.
    startDate: '2026-08-22T11:00:00.000Z',
    endDate: '2026-08-22T11:30:00.000Z',
    isAllDay: false,
    color: null,
    recurrenceSummary: 'Every Saturday and Sunday',
    ...overrides,
  }
}

function payload(overrides: Record<string, unknown> = {}): InvitePayload {
  return {
    invite: {
      id: 'inv1',
      email: 'c@example.com',
      status: 'pending',
      addedToCalendar: false,
    },
    event: baseEvent(),
    occurrences: null,
    inviter: { name: 'Olivia', image: null },
    isRegisteredUser: true,
    categories: [],
    ...overrides,
  }
}

beforeEach(() => {
  state.payload = payload()
  state.patchStatus = 200
  state.patchBody = { success: true }
  state.patches.length = 0

  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'PATCH') {
        state.patches.push(JSON.parse(init.body ?? '{}'))
        return new Response(JSON.stringify(state.patchBody), {
          status: state.patchStatus,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify(state.payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a grant of exactly one occurrence', () => {
  beforeEach(() => {
    state.payload = payload({
      occurrences: [
        {
          // 5 September, NOT the master's 22 August.
          recurrenceId: '20260905T110000Z',
          startDate: '2026-09-05T11:00:00.000Z',
          endDate: '2026-09-05T11:30:00.000Z',
          status: 'pending',
        },
      ],
    })
  })

  it('shows THAT occurrence as the headline date, not the master row', async () => {
    render(<InvitePage />)
    await screen.findByText('Weekend sync')

    // The headline range, sitting directly under the title. The date the
    // participant was actually granted.
    const headline = screen.getByText(
      `${shown('2026-09-05T11:00:00.000Z')} – ${shown('2026-09-05T11:30:00.000Z')}`,
    )
    expect(headline).toBeInTheDocument()
    // The master's date must not be shown anywhere.
    expect(
      screen.queryByText(shown('2026-08-22T11:00:00.000Z'), { exact: false }),
    ).not.toBeInTheDocument()
  })

  it('still shows the occurrence picker', async () => {
    render(<InvitePage />)
    await screen.findByText('Weekend sync')

    expect(screen.getByText('Which date?')).toBeInTheDocument()
  })

  it('answers with that occurrence stamp', async () => {
    render(<InvitePage />)
    await screen.findByText('Weekend sync')

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(state.patches).toHaveLength(1))
    expect(state.patches[0]).toMatchObject({
      status: 'accepted',
      recurrenceId: '20260905T110000Z',
    })
  })
})

describe('a grant reduced to no occurrences', () => {
  beforeEach(() => {
    state.payload = payload({ occurrences: [] })
  })

  it('says the invitation no longer covers any dates', async () => {
    render(<InvitePage />)
    await waitFor(() =>
      expect(
        screen.getByText(/no longer covers any dates/i),
      ).toBeInTheDocument(),
    )
  })

  it('offers no RSVP buttons, since any answer would be refused', async () => {
    render(<InvitePage />)
    await waitFor(() =>
      expect(
        screen.getByText(/no longer covers any dates/i),
      ).toBeInTheDocument(),
    )

    expect(
      screen.queryByRole('button', { name: 'Yes' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Maybe' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'No' })).not.toBeInTheDocument()
  })
})

describe('the default selected occurrence', () => {
  it('is the first occurrence at or after now, not the earliest', async () => {
    // The default was occurrences[0], which can be up to two years in the past —
    // so the default action answered a date that had already passed.
    const past = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    const stamp = (d: Date) =>
      `${d.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`

    state.payload = payload({
      occurrences: [
        {
          recurrenceId: stamp(past),
          startDate: past.toISOString(),
          endDate: past.toISOString(),
          status: 'pending',
        },
        {
          recurrenceId: stamp(future),
          startDate: future.toISOString(),
          endDate: future.toISOString(),
          status: 'pending',
        },
      ],
    })

    render(<InvitePage />)
    await screen.findByText('Weekend sync')

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(state.patches).toHaveLength(1))
    expect(state.patches[0]).toMatchObject({
      recurrenceId: stamp(future),
    })
  })

  it('falls back to the last occurrence when every one has passed', async () => {
    const older = new Date(Date.now() - 60 * 24 * 3600 * 1000)
    const newer = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const stamp = (d: Date) =>
      `${d.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`

    state.payload = payload({
      occurrences: [
        {
          recurrenceId: stamp(older),
          startDate: older.toISOString(),
          endDate: older.toISOString(),
          status: 'pending',
        },
        {
          recurrenceId: stamp(newer),
          startDate: newer.toISOString(),
          endDate: newer.toISOString(),
          status: 'pending',
        },
      ],
    })

    render(<InvitePage />)
    await screen.findByText('Weekend sync')

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(state.patches).toHaveLength(1))
    expect(state.patches[0]).toMatchObject({ recurrenceId: stamp(newer) })
  })
})

describe('add to calendar', () => {
  beforeEach(() => {
    state.payload = payload({
      invite: {
        id: 'inv1',
        email: 'c@example.com',
        status: 'accepted',
        addedToCalendar: false,
      },
    })
  })

  it('keeps the button and surfaces the error when the server refuses', async () => {
    state.patchStatus = 400
    state.patchBody = { error: 'Participant is not a registered user' }

    render(<InvitePage />)
    await screen.findByText('Weekend sync')

    fireEvent.click(screen.getByRole('button', { name: /Add to My Calendar/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(
        screen.getByText(/Participant is not a registered user/i),
      ).toBeInTheDocument(),
    )
    // A refused add must not report success. The dialog stays open with its
    // Add button, so the participant can retry.
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('hides the button once the add succeeds', async () => {
    render(<InvitePage />)
    await screen.findByText('Weekend sync')

    fireEvent.click(screen.getByRole('button', { name: /Add to My Calendar/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /Add to My Calendar/i }),
      ).not.toBeInTheDocument(),
    )
  })
})

describe('a non-recurring invitation', () => {
  it('shows the event dates and answers with no stamp', async () => {
    render(<InvitePage />)
    await screen.findByText('Weekend sync')

    expect(
      screen.getByText(shown('2026-08-22T11:00:00.000Z'), { exact: false }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Which date?')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(state.patches).toHaveLength(1))
    expect(state.patches[0]).toEqual({ status: 'accepted' })
  })
})
