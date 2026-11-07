await import('../../support/dom')
const { render } = await import('@testing-library/react')
import { describe, expect, it } from 'bun:test'

const { ZentraLogo } =
  await import('../../../packages/shared/calendar/components/brand/zentra-logo')

describe('ZentraLogo', () => {
  it('inlines both artworks instead of loading a public route', () => {
    const { container } = render(<ZentraLogo className="size-7" />)

    expect(container.querySelector('img')).toBeNull()
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(2)
    expect(svgs[0].getAttribute('class')).toContain('dark:hidden')
    expect(svgs[1].getAttribute('class')).toContain('dark:block')
    for (const svg of svgs) {
      expect(svg.getAttribute('viewBox')).toBe('0 0 1000 1000')
      expect(svg.querySelector('linearGradient')).not.toBeNull()
      expect(svg.querySelector('clipPath')).not.toBeNull()
    }
  })

  it('pins the dark artwork when the variant asks for it', () => {
    const { container } = render(
      <ZentraLogo variant="dark" className="size-7" />,
    )

    expect(container.querySelectorAll('svg')).toHaveLength(1)
    expect(container.querySelector('svg')?.getAttribute('class')).toContain(
      'size-7',
    )
  })

  it('names itself only when it is not decorative', () => {
    const named = render(<ZentraLogo />)
    expect(named.container.querySelector('svg')?.getAttribute('role')).toBe(
      'img',
    )
    expect(
      named.container.querySelector('svg')?.getAttribute('aria-label'),
    ).toBe('Zentra Calendar')

    const decorative = render(<ZentraLogo decorative />)
    for (const svg of decorative.container.querySelectorAll('svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true')
      expect(svg.getAttribute('aria-label')).toBeNull()
    }
  })
})
