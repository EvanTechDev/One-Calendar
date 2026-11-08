await import('../../support/dom')
const { render, screen, waitFor, within } =
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
// The real shell reads the client language through useSyncExternalStore.
window.matchMedia ??= ((query: string) => ({
  matches: query === '(prefers-color-scheme: dark)',
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return true
  },
})) as typeof window.matchMedia

describe('landing product calendar demo', () => {
  it('renders the real signed-in calendar chrome with sample events', async () => {
    const { container } = render(<LandingCalendarPreview />)

    // Event blocks appear after the lazy WeekView chunk resolves.
    await waitFor(() =>
      expect(
        container.querySelector('[data-event-id="landing-design-critique"]'),
      ).not.toBeNull(),
    )

    // Real signed-in shell: brand, sidebar filters, and event count are all
    // rendered by the same components the app uses.
    expect(
      screen.getByRole('heading', { name: 'Zentra Calendar' }),
    ).toBeTruthy()
    expect(screen.getByText('Create Event')).toBeTruthy()
    expect(screen.getByText('My Calendars')).toBeTruthy()
    expect(screen.getByText('Health')).toBeTruthy()
    expect(screen.getByText('Business')).toBeTruthy()
    expect(screen.getByText('People')).toBeTruthy()
    expect(screen.getByText('Uncategorized')).toBeTruthy()

    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('Today')).toBeTruthy()
    expect(within(banner).getByText('November 2026')).toBeTruthy()
    expect(within(banner).getByRole('combobox').textContent).toContain('Week')

    expect(screen.getByRole('button', { name: 'Bookmarks' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Countdown' })).toBeTruthy()

    expect(container.querySelectorAll('[data-event-id]')).toHaveLength(22)
    expect(
      container.querySelector('[data-event-id="landing-design-critique"]')
        ?.textContent,
    ).toContain('Design sprint critique')
    expect(
      container.querySelector('img[src="/landing-calendar.jpg"]'),
    ).toBeNull()
  })

  it('keeps the example data isolated, read-only, and UTC-based', () => {
    const first = landingDemoEvents()
    const second = landingDemoEvents()
    expect(first).toHaveLength(22)
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
    expect(second[0]!.title).toBe('Design sprint critique')
  })
})
