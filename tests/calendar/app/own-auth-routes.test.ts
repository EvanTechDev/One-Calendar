// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * The calendar links to its own auth pages.
 *
 * The symmetric guard to `tests/meet/app/own-auth-routes`. That one exists because
 * meet kept building its sign-in href from `NEXT_PUBLIC_CALENDAR_ORIGIN` after it
 * had pages of its own — the pages worked and were unreachable from the only screen
 * a signed-out visitor sees.
 *
 * The calendar has never had that bug. This is here so it cannot acquire the
 * mirror of it, which would be the harder one to notice: sending a calendar user to
 * meet to sign in looks deliberate if you already know the two share a session.
 */
const ROOT = resolve(__dirname, '../../..')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/** Files that legitimately name the sibling origin. */
const SIBLING_ORIGIN_IS_FINE = [
  // Trusts the sibling so the shared cookie survives a CSRF origin check.
  'lib/auth/index.ts',
  // The allowlist for a return URL pointing back at the sibling.
  'lib/auth/return-to.ts',
  // Reports configuration, including whether the domains can share a cookie.
  'app/api/diagnostics/meet/route.ts',
]

describe('the calendar does not send users to meet to sign in', () => {
  const files = [
    ...sourceFiles(resolve(ROOT, 'apps/calendar/app')),
    ...sourceFiles(resolve(ROOT, 'apps/calendar/components')),
    ...sourceFiles(resolve(ROOT, 'apps/calendar/lib')),
  ]

  it('finds the source to check', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('never builds an auth URL on another origin', () => {
    const offenders: string[] = []

    for (const file of files) {
      const relative = file.slice(resolve(ROOT, 'apps/calendar').length + 1)
      if (SIBLING_ORIGIN_IS_FINE.includes(relative)) continue

      const source = readFileSync(file, 'utf8')
      if (
        /\$\{[^}]*[Oo]rigin[^}]*\}\/(sign-in|sign-up|reset-password)/.test(
          source,
        )
      ) {
        offenders.push(relative)
      }
      if (/MEET_ORIGIN[^\n]*\/(sign-in|sign-up)/.test(source)) {
        offenders.push(relative)
      }
    }

    expect(offenders).toEqual([])
  })

  it('has the three pages of its own', () => {
    for (const route of ['sign-in', 'sign-up', 'reset-password']) {
      expect(() =>
        statSync(resolve(ROOT, `apps/calendar/app/(auth)/${route}/page.tsx`)),
      ).not.toThrow()
    }
  })
})
