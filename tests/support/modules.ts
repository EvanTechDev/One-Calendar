import { createRequire } from 'node:module'

// Resolve from the app, not the test directory: workspaces can install different
// framework versions, and a mock must replace the source's exact module instance.
export function appModule(app: 'calendar' | 'meet', specifier: string) {
  return createRequire(
    new URL(`../../apps/${app}/package.json`, import.meta.url),
  ).resolve(specifier)
}
