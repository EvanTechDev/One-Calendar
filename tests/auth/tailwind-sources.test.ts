// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Every workspace package holding components must be a Tailwind source.
 *
 * Tailwind v4 generates only the classes it finds by scanning the paths it is
 * given. Both apps listed `packages/ui` and nothing else, so when the auth forms
 * and account panel moved into `packages/auth` (ADR 0022) every class in them
 * vanished from the stylesheet and the entire sign-in surface rendered unstyled.
 *
 * The failure is invisible to a type check, a lint run and every test in this
 * repo — jsdom has no CSS engine, so a component with no styles still passes every
 * assertion about its structure. It is only visible by looking at the page, which
 * is why it reached the user rather than CI.
 */
const ROOT = resolve(__dirname, '../..')

const APPS = ['apps/calendar/app/globals.css', 'apps/meet/app/globals.css']

/** Workspace packages that ship .tsx, and therefore Tailwind classes. */
function packagesWithComponents(): string[] {
  return readdirSync(resolve(ROOT, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      const src = resolve(ROOT, 'packages', entry.name, 'src')
      try {
        return hasTsx(src)
      } catch {
        return false
      }
    })
    .map((entry) => entry.name)
}

function hasTsx(dir: string): boolean {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (hasTsx(resolve(dir, entry.name))) return true
    } else if (entry.name.endsWith('.tsx')) {
      return true
    }
  }
  return false
}

describe('Tailwind sources', () => {
  const withComponents = packagesWithComponents()

  it('finds the packages that ship components', () => {
    // Guards the test itself: a broken discovery step would make every assertion
    // below vacuously true.
    expect(withComponents).toContain('ui')
    expect(withComponents).toContain('auth')
  })

  for (const app of APPS) {
    it(`${app} scans every package that ships components`, () => {
      const css = readFileSync(resolve(ROOT, app), 'utf8')
      const missing = withComponents.filter(
        (pkg) => !css.includes(`packages/${pkg}`),
      )
      expect(missing).toEqual([])
    })
  }
})
