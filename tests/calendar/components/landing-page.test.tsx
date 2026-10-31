await import('../../support/dom')
const { fireEvent, render, screen, within } =
  await import('@testing-library/react')
import { describe, expect, it } from 'bun:test'

// Render the accessible reduced-motion path in jsdom.
window.matchMedia ??= ((query: string) => ({
  matches: query === '(prefers-reduced-motion: reduce)',
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

const { default: LandingPage } =
  await import('../../../apps/calendar/app/(landing)/page')

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as never
Element.prototype.scrollTo ??= function scrollTo() {}
Element.prototype.scrollIntoView ??= function scrollIntoView() {}

describe('signed-out landing page', () => {
  it('keeps account entry points and all section links usable', () => {
    const { container } = render(<LandingPage />)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('main').id).toBe('main-content')
    for (const label of ['Get started', 'Sign in']) {
      const links = screen.getAllByRole('link', { name: label, exact: true })
      expect(links.length).toBeGreaterThan(1)
      for (const link of links) {
        expect(link.getAttribute('href')).toBe(
          label === 'Sign in' ? '/sign-in' : '/sign-up',
        )
        if (label === 'Get started') {
          expect(link.getAttribute('data-size')).toBe('sm')
          expect(link.querySelector('svg')).toBeNull()
        }
      }
    }
    for (const link of container.querySelectorAll<HTMLAnchorElement>(
      'a[href*="#"]',
    )) {
      const target = new URL(link.href).hash.slice(1)
      expect(container.querySelector(`[id="${target}"]`)).not.toBeNull()
    }
    expect(container.querySelector('a button, button a')).toBeNull()
    const brand = container.querySelector('.landing-brand > span')!
    expect(brand.textContent).toBe('Zentra Calendar')
    expect(brand.children).toHaveLength(0)
  })

  it('keeps legal navigation without documentation promotion links', () => {
    const { container } = render(<LandingPage />)
    expect(
      container.querySelectorAll('a[href^="https://xyehr.cn/docs"]'),
    ).toHaveLength(0)
    expect(
      screen.getByRole('link', { name: 'Privacy policy' }).getAttribute('href'),
    ).toBe('/privacy')
    expect(
      screen
        .getByRole('link', { name: 'Terms of service' })
        .getAttribute('href'),
    ).toBe('/terms')
  })

  it('uses English product facts and makes material limitations visible', () => {
    const { container } = render(<LandingPage />)
    const text = container.textContent ?? ''

    expect(text).toContain('AI features require an AI-enabled deployment.')
    expect(text).toContain('Link imports are one-time reads, not two-way sync.')
    expect(text).toContain('Browser reminders need Calendar open')
    expect(text).toContain('MIT License')
    expect(text).toContain('up to five reminder emails per day')
    expect(text).not.toMatch(/[\u3400-\u9fff]/u)
    expect(text).not.toMatch(/99\.9%|3×|Free forever|Enterprise Security/)
    expect(text).toContain('Elena Fischer')
    expect(text).toContain('Marcus Oyelaran')
    expect(container.querySelectorAll('blockquote')).toHaveLength(2)
    expect(container.querySelector('.landing-facts')).toBeNull()
    expect(container.querySelector('#calendar img')?.getAttribute('src')).toBe(
      '/landing-calendar.jpg',
    )
    expect(container.querySelector('img[src^="http"]')).toBeNull()
  })

  it('provides native expandable answers without a JS accordion', () => {
    const { container } = render(<LandingPage />)
    const faq = container.querySelector('#questions')!
    const answers = faq.querySelectorAll('details')

    expect(answers).toHaveLength(5)
    for (const answer of answers) {
      expect(answer.querySelector('summary')?.textContent).toBeTruthy()
      expect(answer.querySelector('p')?.textContent).toBeTruthy()
    }
  })

  it('closes the mobile menu after navigation and on Escape', () => {
    const { container } = render(<LandingPage />)
    const menu = container.querySelector<HTMLDetailsElement>(
      '.landing-mobile-menu',
    )!
    const summary = menu.querySelector('summary')!
    const navigation = screen.getByRole('navigation', {
      name: 'Mobile navigation',
      hidden: true,
    })

    menu.open = true
    fireEvent.click(
      within(navigation).getByRole('link', { name: 'Product', exact: true }),
    )
    expect(menu.open).toBe(false)
    expect(window.location.hash).toBe('#features')
    expect(document.activeElement?.id).toBe('features')

    menu.open = true
    const changelog = within(navigation).getByRole('link', {
      name: 'Changelog',
    })
    changelog.focus()
    fireEvent.keyDown(changelog, { key: 'Escape' })
    expect(menu.open).toBe(false)
    expect(document.activeElement).toBe(summary)
  })
})
