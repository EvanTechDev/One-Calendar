// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'

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

interface Manifest {
  name: string
  dependencies?: Record<string, string>
  exports?: Record<string, string>
}

const workspaces = new Map(
  [
    ...readdirSync(resolve(ROOT, 'packages'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(ROOT, 'packages', entry.name)),
    resolve(ROOT, 'packages/ui/calendar'),
  ]
    .filter((directory) => existsSync(resolve(directory, 'package.json')))
    .map((directory) => {
      const manifest: Manifest = JSON.parse(
        readFileSync(resolve(directory, 'package.json'), 'utf8'),
      )
      return [manifest.name, { directory, manifest }] as const
    }),
)

function componentDependencies(app: string): string[] {
  const manifest: Manifest = JSON.parse(
    readFileSync(resolve(ROOT, dirname(app), '../package.json'), 'utf8'),
  )
  const visited = new Set<string>()
  function visit(value: Manifest) {
    for (const name of Object.keys(value.dependencies ?? {})) {
      const workspace = workspaces.get(name)
      if (!workspace || visited.has(name)) continue
      visited.add(name)
      visit(workspace.manifest)
    }
  }
  visit(manifest)
  return [...visited].flatMap((name) => {
    const source = resolve(workspaces.get(name)!.directory, 'src')
    return hasTsx(source) ? [source] : []
  })
}

/** Follow workspace stylesheet exports, just as Tailwind's importer does. */
function sourceDirectories(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file)) return []
  seen.add(file)
  const css = readFileSync(file, 'utf8')
  const sources = [...css.matchAll(/@source\s+['"]([^'"]+)['"]/g)].map(
    (match) => resolve(dirname(file), match[1]),
  )
  for (const match of css.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
    const specifier = match[1]
    if (specifier.startsWith('.')) {
      sources.push(
        ...sourceDirectories(resolve(dirname(file), specifier), seen),
      )
      continue
    }
    const name = specifier.split('/').slice(0, 2).join('/')
    const workspace = workspaces.get(name)
    const exported =
      workspace?.manifest.exports?.[`.${specifier.slice(name.length)}`]
    if (workspace && typeof exported === 'string') {
      sources.push(
        ...sourceDirectories(resolve(workspace.directory, exported), seen),
      )
    }
  }
  return sources
}

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
    it(`${app} scans the component packages it actually consumes`, () => {
      const sources = sourceDirectories(resolve(ROOT, app))
      const missing = componentDependencies(app).filter(
        (source) =>
          !sources.some(
            (directory) =>
              source === directory || source.startsWith(`${directory}${sep}`),
          ),
      )
      expect(missing).toEqual([])
    })
  }
})
