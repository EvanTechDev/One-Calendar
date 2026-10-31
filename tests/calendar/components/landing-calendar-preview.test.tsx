await import('../../support/dom')
const { fireEvent, render, screen } = await import('@testing-library/react')
import { describe, expect, it } from 'bun:test'
const { LandingCalendarPreview } =
  await import('../../../apps/calendar/components/landing-calendar-preview')

const today = '2026-10-31'

describe('landing calendar view explorer', () => {
  it('starts with the real date in an explicitly empty illustration', () => {
    const { container } = render(<LandingCalendarPreview today={today} />)

    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Month' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(screen.getByText('Illustrated preview · No event data')).toBeTruthy()
    expect(container.querySelector('[data-today]')?.textContent).toBe('31')
    expect(container.querySelectorAll('.landing-date-cell')).toHaveLength(35)
    expect(
      screen.getByRole('region', { name: 'Month view illustration' }).tabIndex,
    ).toBe(0)
  })

  it('switches all five real view types and updates their accessible state', () => {
    const { container } = render(<LandingCalendarPreview today={today} />)
    const expectedColumns = { Day: 1, 'Four days': 4, Week: 7 }

    for (const [label, count] of Object.entries(expectedColumns)) {
      fireEvent.click(screen.getByRole('button', { name: label, exact: true }))
      expect(
        screen
          .getByRole('button', { name: label, exact: true })
          .getAttribute('aria-pressed'),
      ).toBe('true')
      expect(container.querySelectorAll('.landing-time-day')).toHaveLength(
        count,
      )
      expect(
        screen.getByRole('region', { name: `${label} view illustration` }),
      ).toBeTruthy()
      expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
    }

    fireEvent.click(screen.getByRole('button', { name: 'Year', exact: true }))
    expect(
      screen.getByRole('heading', { name: '2026', exact: true }),
    ).toBeTruthy()
    expect(container.querySelectorAll('.landing-year-grid h4')).toHaveLength(12)
    expect(screen.getByText('January')).toBeTruthy()
    expect(screen.getByText('December')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Month', exact: true }))
    expect(container.querySelector('.landing-month-grid')).toBeTruthy()
  })

  it('moves one month at a time without skipping November after October 31', () => {
    render(<LandingCalendarPreview today={today} />)

    fireEvent.click(screen.getByRole('button', { name: 'Next period' }))
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }))
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }))
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    fireEvent.click(screen.getByRole('button', { name: 'Day', exact: true }))
    expect(
      screen.getByRole('heading', { name: 'October 31, 2026' }),
    ).toBeTruthy()
  })

  it('navigates days, four-day periods, and weeks across a month boundary', () => {
    const { container } = render(<LandingCalendarPreview today={today} />)

    fireEvent.click(screen.getByRole('button', { name: 'Day', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Next period' }))
    expect(
      screen.getByRole('heading', { name: 'November 1, 2026' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }))
    expect(
      screen.getByRole('heading', { name: 'October 31, 2026' }),
    ).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: 'Four days', exact: true }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Next period' }))
    expect(container.querySelector('.landing-time-day')?.textContent).toBe(
      'Wed4',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    fireEvent.click(screen.getByRole('button', { name: 'Week', exact: true }))
    expect(container.querySelector('.landing-time-day')?.textContent).toBe(
      'Mon26',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Next period' }))
    expect(container.querySelector('.landing-time-day')?.textContent).toBe(
      'Mon2',
    )
  })

  it('handles a leap-year month and year navigation', () => {
    const { container } = render(<LandingCalendarPreview today="2028-02-29" />)

    expect(container.querySelector('[data-today]')?.textContent).toBe('29')
    fireEvent.click(screen.getByRole('button', { name: 'Year', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Next period' }))
    expect(
      screen.getByRole('heading', { name: '2029', exact: true }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }))
    expect(
      screen.getByRole('heading', { name: '2028', exact: true }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(
      screen
        .getByRole('button', { name: 'Year', exact: true })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })
})
