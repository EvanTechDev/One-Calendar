await import('./../../support/dom')
const { createElement } = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
import { expect, it } from 'bun:test'
const { DesktopState } =
  await import('../../../apps/calendar-client/src/desktop-surfaces')

it('uses the original inline logo loading screen without a custom heading', () => {
  const html = renderToStaticMarkup(createElement(DesktopState))
  expect(html).toContain('waiting-grad-light')
  expect(html).not.toContain('Getting your calendar ready')
  expect(html).not.toContain('desktop-brand')
  expect(html).not.toContain('<header')
})

it('keeps failure recovery controls without a top bar', () => {
  const html = renderToStaticMarkup(
    createElement(DesktopState, { failed: true }),
  )
  expect(html).toContain('Reload calendar')
  expect(html).toContain('role="alert"')
  expect(html).not.toContain('desktop-brand')
  expect(html).not.toContain('<header')
})
