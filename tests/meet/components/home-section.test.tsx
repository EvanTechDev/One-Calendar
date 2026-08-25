import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { HomeSection } from '@/components/dashboard/home-section'
import type { UpcomingRow } from '@/hooks/use-upcoming-meetings'

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

afterEach(cleanup)

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

  it('does not host start/join — those moved into the dialog', () => {
    renderHome()
    expect(screen.queryByLabelText('Meeting code or link')).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Start an instant meeting/ }),
    ).toBeNull()
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
})
