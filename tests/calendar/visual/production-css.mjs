import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

// Use Next's actual production CSS with the deterministic shared calendar.
// A Vite-generated stylesheet previously concealed a broken Next source scan.
const nextOrigin = 'http://127.0.0.1:3000'
const fixtureOrigin = 'http://127.0.0.1:4173'
const artifacts = 'artifacts/calendar-ui'
await mkdir(artifacts, { recursive: true })
const htmlResponse = await fetch(`${nextOrigin}/sign-in`)
assert.equal(htmlResponse.status, 200)
const html = await htmlResponse.text()
const styles = [...html.matchAll(/<link\b[^>]*>/g)]
  .map(([tag]) =>
    /\brel="stylesheet"/.test(tag) ? tag.match(/\bhref="([^"]+)"/)?.[1] : null,
  )
  .filter(Boolean)
assert(styles.length > 0, 'Next did not emit any production stylesheets')
const css = (
  await Promise.all(
    styles.map(async (href) => {
      const response = await fetch(new URL(href, nextOrigin))
      assert.equal(response.status, 200)
      return response.text()
    }),
  )
).join('\n')
assert(
  /\.grid-cols-7\s*\{/.test(css),
  'Next production CSS is missing calendar grid-cols-7',
)
await writeFile(`${artifacts}/production.css`, css)
const bodyClasses = html.match(/<body\b[^>]*\bclass="([^"]+)"/)?.[1] ?? ''
const browser = await chromium.launch()
const errors = []
try {
  const context = await browser.newContext({
    timezoneId: 'UTC',
    locale: 'en-US',
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/_next/static/**', async (route) => {
    const url = new URL(route.request().url())
    const response = await route.fetch({
      url: `${nextOrigin}${url.pathname}${url.search}`,
    })
    await route.fulfill({ response })
  })
  async function captureCalendar(name, width, height, query = '') {
    await page.setViewportSize({ width, height })
    await page.goto(`${fixtureOrigin}/${query}`)
    await page.locator('[aria-label="Help"]').waitFor()
    assert(
      await page
        .locator('style')
        .evaluateAll((elements) =>
          elements.every(
            (element) => !element.textContent.includes('.grid-cols-7'),
          ),
        ),
      'Vite CSS concealed the Next production stylesheet',
    )
    await page.evaluate((classes) => {
      document.body.className = classes
    }, bodyClasses)
    for (const href of styles)
      await page.addStyleTag({ url: new URL(href, fixtureOrigin).href })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    if (query.includes('month')) {
      const grids = await page.locator('.grid-cols-7').evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element)
          return {
            display: style.display,
            columns: style.gridTemplateColumns.split(' ').length,
          }
        }),
      )
      assert(grids.length > 0, 'The actual month grid did not render')
      assert(
        grids.every((grid) => grid.display === 'grid' && grid.columns === 7),
        'Month columns collapsed with production CSS',
      )
      await page.getByText('Weekly planning', { exact: true }).first().waitFor()
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'Calendar overflows horizontally',
    )
    await page.screenshot({ path: `${artifacts}/${name}.png` })
  }
  await captureCalendar('web-reference-width', 1280, 900)
  await captureCalendar('web-desktop-width', 1200, 680)
  await captureCalendar('web-month-events', 1280, 900, '?view=month&events=1')
  for (const [surface, theme, width, height] of [
    ['welcome', 'light', 1200, 680],
    ['welcome', 'dark', 1200, 680],
    ['waiting', 'light', 1200, 680],
    ['error', 'light', 1200, 680],
    ['settings', 'light', 1200, 680],
    ['failed', 'dark', 1200, 680],
    ['welcome', 'light', 640, 600],
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto(`${fixtureOrigin}/?surface=${surface}&theme=${theme}`)
    await page.locator('main').waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(200)
    if (surface === 'settings') {
      await page.getByRole('button', { name: 'Check for updates' }).click()
      await page.getByText('You are up to date.').waitFor()
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'Desktop surface overflows horizontally',
    )
    await page.screenshot({
      path: `${artifacts}/desktop-${surface}-${theme}-${width}.png`,
    })
  }
  assert.deepEqual(errors, [], 'Browser rendering raised errors')
  await writeFile(
    `${artifacts}/evidence.json`,
    JSON.stringify(
      {
        source: process.env.GITHUB_SHA,
        stylesheetUrls: styles,
        browserErrors: errors,
        monthColumns: 7,
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
