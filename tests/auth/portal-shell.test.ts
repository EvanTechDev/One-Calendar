import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * The three apps' shells must stay structurally identical.
 *
 * The owner's requirement is that the portal, the calendar's `/app`, and meet's
 * dashboard read as one product. That is a claim about specific class strings —
 * `h-dvh`, `w-[247px]`, `h-16` — and jsdom cannot check whether two apps *look*
 * alike, so the check is on the source: the strings that produce the layout are
 * asserted to be present in all three.
 *
 * Reading files rather than rendering is deliberate. Rendering the calendar's
 * shell needs its whole provider tree, and a test that had to boot three apps
 * would be skipped the first time it broke. This one cannot rot silently: it
 * fails the moment one app's rail changes width.
 */
const ROOT = path.resolve(import.meta.dirname, '../..')

function read(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8')
}

const PORTAL = 'apps/auth/components/shell/portal-shell.tsx'
const MEET = 'apps/meet/components/shell/meet-shell.tsx'
const CALENDAR = 'apps/calendar/components/app/calendar.tsx'
// The calendar splits its shell across two files: the outer container lives in
// calendar.tsx, the rail in sidebar.tsx. Asserting the width against the wrong
// one is how this test first failed.
const CALENDAR_SIDEBAR = 'apps/calendar/components/app/sidebar/sidebar.tsx'

describe('shell layout parity', () => {
  it('gives all three apps the same full-height flex outer', () => {
    // The container that makes a sidebar a sidebar rather than a column on a
    // scrolling page.
    for (const file of [PORTAL, MEET, CALENDAR]) {
      expect(read(file), file).toContain(
        'relative flex h-dvh overflow-hidden bg-background',
      )
    }
  })

  it('gives all three the same rail width', () => {
    // 247px is arbitrary but shared. A different width in one app is the single
    // most visible way three apps stop looking like one.
    for (const file of [PORTAL, MEET, CALENDAR_SIDEBAR]) {
      expect(read(file), file).toContain('w-[247px]')
    }
  })

  it('gives all three an h-16 bordered header', () => {
    for (const file of [PORTAL, MEET, CALENDAR]) {
      const source = read(file)
      expect(source, file).toContain('h-16')
      expect(source, file).toContain('border-b')
    }
  })

  it('gives the portal and meet the same main-column constraints', () => {
    // `min-h-0` on a flex child is what allows the main area to scroll instead
    // of the page. Losing it is a subtle break that only shows with content.
    for (const file of [PORTAL, MEET]) {
      expect(read(file), file).toContain('flex min-h-0 min-w-0 flex-1 flex-col')
    }
  })

  it('uses one nav item vocabulary across the portal and meet', () => {
    // Copied from the calendar's settings nav. Three apps with three different
    // hover treatments is the kind of drift nobody notices individually.
    const idle = 'text-muted-foreground hover:bg-muted hover:text-foreground'
    const active = 'bg-accent font-medium text-accent-foreground'
    const item =
      'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors'

    for (const file of [PORTAL, MEET]) {
      const source = read(file)
      expect(source, `${file} idle`).toContain(idle)
      expect(source, `${file} active`).toContain(active)
      expect(source, `${file} item`).toContain(item)
    }
  })

  it('collapses the rail into a left Sheet below sm in the portal and meet', () => {
    // The calendar has no mobile shell to copy, so these two define it. `sm` is
    // the repo's breakpoint convention.
    for (const file of [PORTAL, MEET]) {
      const source = read(file)
      expect(source, file).toContain('side="left"')
      expect(source, file).toContain('sm:hidden')
      expect(source, file).toContain('hidden w-[247px]')
    }
  })

  it('shares the brand block shape', () => {
    for (const file of [PORTAL, MEET]) {
      expect(read(file), file).toContain('mb-3 flex items-center')
      expect(read(file), file).toContain('text-lg font-semibold')
    }
  })
})
