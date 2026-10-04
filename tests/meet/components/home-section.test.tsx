import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  act,
  render,
  cleanup,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react'
import { HomeSection } from '@/components/dashboard/home-section'
import type { UpcomingRow } from '@/hooks/use-upcoming-meetings'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

/**
 * Home after the redesign. The behaviours worth pinning are that it is not an
 * empty shell (it surfaces the next meeting and a rejoin list), that it offers
 * a path to the New meeting dialog on its own — the sidebar's button is
 * invisible below `sm`, where the rail collapses into a Sheet — and that it
 * hands off to the other sections rather than duplicating them.
 */

const row = (overrides?: Partial<UpcomingRow>): UpcomingRow => ({
  meetingId: 'ab3k-x9q2',
  eventId: 'event-1',
  title: 'Weekly standup',
  startDate: new Date(Date.now() + 3_600_000).toISOString(),
  endDate: new Date(Date.now() + 7_200_000).toISOString(),
  ...overrides,
})

function renderHome(overrides?: {
  rows?: UpcomingRow[] | null
  failed?: boolean
  userName?: string | undefined
}) {
  const onNewMeeting = vi.fn()
  const onSectionChange = vi.fn()
  render(
    <HomeSection
      userName={
        'userName' in (overrides ?? {}) ? overrides!.userName : 'Ada Lovelace'
      }
      upcoming={{
        rows: overrides?.rows === undefined ? [row()] : overrides.rows,
        failed: overrides?.failed ?? false,
      }}
      recentPreview={<p>recent rooms list</p>}
      onNewMeeting={onNewMeeting}
      onSectionChange={onSectionChange}
    />,
  )
  return { onNewMeeting, onSectionChange }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('HomeSection', () => {
  it('greets the user by first name', () => {
    renderHome()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(
      /Good (morning|afternoon|evening|night), Ada/,
    )
  })

  it('greets without a name rather than showing a stray comma', () => {
    renderHome({ userName: undefined })
    expect(screen.getByRole('heading', { level: 2 }).textContent).not.toContain(
      ',',
    )
  })

  it('offers its own route into the New meeting dialog', () => {
    // The sidebar's button is behind a Sheet below sm, so home needs one too.
    const { onNewMeeting } = renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'New meeting' }))
    expect(onNewMeeting).toHaveBeenCalledOnce()
  })

  it('joins from home without opening the creation dialog and preserves the invite key', () => {
    const { onNewMeeting } = renderHome()
    fireEvent.change(screen.getByLabelText('Meeting code or link'), {
      target: {
        value: 'https://meet.example.com/ab3k-x9q2?hq=true#pass-phrase',
      },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Join a meeting' }))
    expect(push).toHaveBeenCalledWith('/ab3k-x9q2?hq=true#pass-phrase')
    expect(onNewMeeting).not.toHaveBeenCalled()
  })

  it('keeps meeting creation and its encryption choice in the dialog', () => {
    renderHome()
    expect(
      screen.queryByRole('button', { name: /Start an instant meeting/ }),
    ).toBeNull()
  })

  it('pastes an invite for review before joining, without losing its hash', async () => {
    const readText = vi
      .fn()
      .mockResolvedValue('https://meet.example.com/ab3k-x9q2#secret')
    vi.stubGlobal(
      'navigator',
      Object.create(navigator, {
        clipboard: { value: { readText } },
      }),
    )
    renderHome()
    expect(readText).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Paste meeting link' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Meeting code or link')).toHaveValue(
        'https://meet.example.com/ab3k-x9q2#secret',
      ),
    )
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Meeting code or link')).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(push).toHaveBeenCalledWith('/ab3k-x9q2#secret')
  })

  it('keeps manual entry usable when clipboard access is denied', async () => {
    vi.stubGlobal(
      'navigator',
      Object.create(navigator, {
        clipboard: {
          value: { readText: vi.fn().mockRejectedValue(new Error('denied')) },
        },
      }),
    )
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Paste meeting link' }))
    await screen.findByText(/Clipboard unavailable/)
    const input = screen.getByLabelText('Meeting code or link')
    expect(input).toHaveFocus()
    fireEvent.change(input, { target: { value: 'ab3k-x9q2' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Join a meeting' }))
    expect(push).toHaveBeenCalledWith('/ab3k-x9q2')
  })

  it('explains invalid input and never navigates to it', () => {
    renderHome()
    const input = screen.getByLabelText('Meeting code or link')
    fireEvent.change(input, { target: { value: 'not-a-room' } })
    fireEvent.blur(input)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/Use a meeting code like/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: 'Join a meeting' }))
    expect(push).not.toHaveBeenCalled()
  })

  it('surfaces exactly one next meeting, with a join link', () => {
    renderHome({ rows: [row(), row({ meetingId: 'zz11-zz22' })] })
    const joins = screen.getAllByRole('link', { name: 'Join' })
    expect(joins).toHaveLength(1)
    expect(joins[0]).toHaveAttribute('href', '/ab3k-x9q2')
    expect(screen.getByText('Weekly standup')).toBeTruthy()
  })

  it('says nothing is scheduled rather than rendering a blank card', () => {
    renderHome({ rows: [] })
    expect(screen.getByText(/Nothing on your calendar/)).toBeTruthy()
  })

  it('distinguishes an unreachable calendar from an empty one', () => {
    renderHome({ rows: [], failed: true })
    expect(screen.getByText(/could not be reached/)).toBeTruthy()
  })

  it('shows a skeleton while the calendar is still being read', () => {
    renderHome({ rows: null })
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy()
  })

  it('renders the recent rooms it was given', () => {
    renderHome()
    expect(screen.getByText('recent rooms list')).toBeTruthy()
  })

  it('hands off to the full sections instead of duplicating them', () => {
    const { onSectionChange } = renderHome()
    const [upcomingLink, historyLink] = screen.getAllByRole('button', {
      name: 'See all',
    })
    fireEvent.click(upcomingLink!)
    expect(onSectionChange).toHaveBeenCalledWith('upcoming')
    fireEvent.click(historyLink!)
    expect(onSectionChange).toHaveBeenCalledWith('history')
  })

  it('updates the scheduled countdown and advances when a meeting ends', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-04T09:00:00Z'))
    renderHome({
      rows: [
        row({
          startDate: '2026-10-04T09:01:00Z',
          endDate: '2026-10-04T09:02:00Z',
        }),
        row({
          meetingId: 'zz11-zz22',
          title: 'Design review',
          startDate: '2026-10-04T09:10:00Z',
          endDate: '2026-10-04T10:00:00Z',
        }),
      ],
    })
    expect(screen.getByText('Starts in 1 min')).toBeTruthy()
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByText('Scheduled now')).toBeTruthy()
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.queryByText('Weekly standup')).toBeNull()
    expect(screen.getByText('Design review')).toBeTruthy()
    expect(screen.getByText('Starts in 8 min')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute(
      'href',
      '/zz11-zz22',
    )
  })

  it('refreshes immediately on tab return after timers have been throttled', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-04T09:00:00Z'))
    renderHome({
      rows: [
        row({
          startDate: '2026-10-04T09:01:00Z',
          endDate: '2026-10-04T09:02:00Z',
        }),
      ],
    })
    vi.setSystemTime(new Date('2026-10-04T09:03:00Z'))
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.queryByText('Weekly standup')).toBeNull()
    expect(screen.getByText(/Nothing on your calendar/)).toBeTruthy()
  })
})
