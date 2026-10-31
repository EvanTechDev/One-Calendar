await import('../../support/dom')
const { fireEvent, render, screen, within } =
  await import('@testing-library/react')
import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
const { default: LandingPage } =
  await import('../../../apps/calendar/app/(landing)/page')

describe('signed-out landing page', () => {
  it('keeps account entry points and all section links usable', () => {
    const { container } = render(<LandingPage />)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('main').id).toBe('main-content')
    for (const label of ['Create account', 'Sign in']) {
      const links = screen.getAllByRole('link', { name: label, exact: true })
      expect(links.length).toBeGreaterThan(1)
      for (const link of links) {
        expect(link.getAttribute('href')).toBe(
          label === 'Sign in' ? '/sign-in' : '/sign-up',
        )
      }
    }
    for (const link of container.querySelectorAll<HTMLAnchorElement>(
      'a[href*="#"]',
    )) {
      const target = new URL(link.href).hash.slice(1)
      expect(container.querySelector(`[id="${target}"]`)).not.toBeNull()
    }
    expect(container.querySelector('a button, button a')).toBeNull()
  })

  it('links feature descriptions to actual documentation pages', () => {
    const { container } = render(<LandingPage />)
    const root = resolve(import.meta.dir, '../../..')
    const guides = container.querySelectorAll<HTMLAnchorElement>(
      'a[href^="https://xyehr.cn/docs/"]',
    )

    expect(guides.length).toBeGreaterThanOrEqual(10)
    for (const link of guides) {
      const slug = new URL(link.href).pathname.slice('/docs/'.length)
      expect(existsSync(resolve(root, `docs/content/docs/${slug}.mdx`))).toBe(
        true,
      )
    }
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
    expect(text).not.toMatch(
      /99\.9%|3×|Elena Fischer|Marcus Oyelaran|Free forever|Enterprise Security/,
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
    fireEvent.click(within(navigation).getByRole('link', { name: 'Features' }))
    expect(menu.open).toBe(false)

    menu.open = true
    const docs = within(navigation).getByRole('link', { name: 'Docs' })
    docs.focus()
    fireEvent.keyDown(docs, { key: 'Escape' })
    expect(menu.open).toBe(false)
    expect(document.activeElement).toBe(summary)
  })
})
