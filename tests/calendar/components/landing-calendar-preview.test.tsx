await import('../../support/dom')
const { fireEvent, render, screen, waitFor, within } =
  await import('@testing-library/react')
import { describe, expect, it } from 'bun:test'
const { LandingCalendarPreview } =
  await import('../../../apps/calendar/components/landing-calendar-preview')
const { landingDemoEvents } =
  await import('../../../apps/calendar/lib/landing-demo')

// Real calendar views measure and scroll their grid; jsdom has no layout APIs.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as never
Element.prototype.scrollTo ??= function scrollTo() {}
Element.prototype.scrollIntoView ??= function scrollIntoView() {}

describe('landing product calendar demo', () => {
  it('renders the actual week grid with explicitly labeled sample events', () => {
    const { container } = render(<LandingCalendarPreview />)

    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Week', exact: true })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen.getByText('Sample schedule · Nov 2–8, 2026 · UTC'),
    ).toBeTruthy()
    expect(
      container.querySelector('[data-event-id="landing-focus"]')?.textContent,
    ).toContain('Focus time')
    expect(container.querySelectorAll('[data-event-id]')).toHaveLength(11)
    expect(
      screen.getByRole('region', { name: 'Interactive sample calendar' })
        .tabIndex,
    ).toBe(0)
  })

  it('filters the same sample dataset by category', () => {
    const { container } = render(<LandingCalendarPreview />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Personal', exact: true }),
    )

    expect(
      screen
        .getByRole('button', { name: 'Personal', exact: true })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      container.querySelector('[data-event-id="landing-focus"]'),
    ).toBeNull()
    expect(
      container.querySelector('[data-event-id="landing-reading"]'),
    ).not.toBeNull()
    expect(container.querySelectorAll('[data-event-id]')).toHaveLength(5)

    fireEvent.click(
      screen.getByRole('button', { name: 'All events', exact: true }),
    )
    expect(container.querySelectorAll('[data-event-id]')).toHaveLength(11)
  })

  it('navigates weeks and resets the date, view, and filters', () => {
    const { container } = render(<LandingCalendarPreview />)
    fireEvent.click(screen.getByRole('button', { name: 'Next period' }))
    expect(container.querySelectorAll('[data-event-id]')).toHaveLength(0)
    fireEvent.click(
      screen.getByRole('button', { name: 'Personal', exact: true }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }))
    expect(container.querySelectorAll('[data-event-id]')).toHaveLength(11)
    expect(
      screen
        .getByRole('button', { name: 'All events', exact: true })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('loads the actual month view and navigates calendar months', async () => {
    const { container } = render(<LandingCalendarPreview />)
    fireEvent.click(screen.getByRole('button', { name: 'Month', exact: true }))
    await waitFor(() =>
      expect(container.querySelector('[data-day-cell]')).not.toBeNull(),
    )

    expect(
      screen
        .getByRole('button', { name: 'Month', exact: true })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      container.querySelector('[data-event-id="landing-focus"]'),
    ).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Next period' }))
    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }))
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }))
    expect(
      screen
        .getByRole('button', { name: 'Week', exact: true })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('offers a keyboard-accessible sample list and event details', () => {
    render(<LandingCalendarPreview />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Browse sample events' }),
    )
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText(
        'These are fictional example events, not a real person’s calendar.',
      ),
    ).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: /Focus time/ }))
    expect(
      within(dialog).getByRole('heading', { name: 'Focus time' }),
    ).toBeTruthy()
    expect(
      within(dialog)
        .getByRole('link', { name: 'Create account' })
        .getAttribute('href'),
    ).toBe('/sign-up')
  })

  it('keeps the example data isolated, read-only, and UTC-based', () => {
    const first = landingDemoEvents()
    const second = landingDemoEvents()
    expect(first).toHaveLength(11)
    expect(first).not.toBe(second)
    for (const event of first) {
      expect(event.viewOnly).toBe(true)
      expect(event.id.startsWith('landing-')).toBe(true)
      expect(event.participants).toHaveLength(0)
      expect(event.notification).toBeNull()
      expect(event.startDate.getUTCMonth()).toBe(10)
      expect(event.endDate.getTime()).toBeGreaterThan(event.startDate.getTime())
    }
    first[0]!.title = 'Changed only in this instance'
    expect(second[0]!.title).toBe('Plan the week')
  })
})
