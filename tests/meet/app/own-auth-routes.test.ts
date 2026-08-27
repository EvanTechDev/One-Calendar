// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * Meet links to its OWN auth pages.
 *
 * It has had them since ADR 0022, but the guest page still built its sign-in href
 * from `NEXT_PUBLIC_CALENDAR_ORIGIN` — a leftover from when meet had no sign-in
 * surface and the only way in was to send the user to the calendar and hope they
 * came back.
 *
 * The result was worse than the old behaviour: the pages existed, worked, and were
 * unreachable from the one screen a signed-out visitor actually sees.
 *
 * This walks the source rather than asserting on one file, because the bug was a
 * leftover in a place nobody thought to look.
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
  // The shared cookie needs the sibling trusted for CSRF.
  'lib/auth/index.ts',
  // The allowlist for a return URL pointing back at the sibling.
  'lib/auth/return-to.ts',
  // Reports configuration, including whether the two domains can share a cookie.
  'app/api/diagnostics/route.ts',
  // Upcoming meetings are read from the calendar, which owns recurrence
  // expansion (ADR 0017) — a data call, not a navigation.
  'hooks/use-upcoming-meetings.ts',
  'components/dashboard/dashboard.tsx',
  'components/dashboard/dashboard-shell.tsx',
]

describe('meet does not send users to the calendar to sign in', () => {
  const files = [
    ...sourceFiles(resolve(ROOT, 'apps/meet/app')),
    ...sourceFiles(resolve(ROOT, 'apps/meet/components')),
    ...sourceFiles(resolve(ROOT, 'apps/meet/lib')),
  ]

  it('finds the source to check', () => {
    // Guards the test: a broken walk makes everything below vacuously true.
    expect(files.length).toBeGreaterThan(20)
  })

  it('never builds an auth URL on another origin', () => {
    const offenders: string[] = []

    for (const file of files) {
      const relative = file.slice(resolve(ROOT, 'apps/meet').length + 1)
      if (SIBLING_ORIGIN_IS_FINE.includes(relative)) continue

      const source = readFileSync(file, 'utf8')
      // An auth path interpolated after something origin-shaped is the shape of
      // the bug: `${origin}/sign-in`.
      if (
        /\$\{[^}]*[Oo]rigin[^}]*\}\/(sign-in|sign-up|reset-password)/.test(
          source,
        )
      ) {
        offenders.push(relative)
      }
      if (/CALENDAR_ORIGIN[^\n]*\/(sign-in|sign-up)/.test(source)) {
        offenders.push(relative)
      }
    }

    expect(offenders).toEqual([])
  })

  it('links to its own relative auth routes instead', () => {
    const page = readFileSync(resolve(ROOT, 'apps/meet/app/page.tsx'), 'utf8')
    expect(page).toMatch(/href=["'{]\/sign-in/)
  })

  it('has the pages those links point at', () => {
    for (const route of ['sign-in', 'sign-up', 'reset-password']) {
      expect(() =>
        statSync(resolve(ROOT, `apps/meet/app/(auth)/${route}/page.tsx`)),
      ).not.toThrow()
    }
  })
})
