import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// Bun's --sequential runner orders by name, not dependencies. Keep builds
// dependency-ordered without running memory-heavy app builds concurrently.
const root = process.cwd()
const task = process.argv[2]
if (!task) throw new Error('A workspace script name is required')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const packages = new Map()
for (const pattern of manifest.workspaces) {
  const directories = pattern.endsWith('/*')
    ? readdirSync(join(root, pattern.slice(0, -2)), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(pattern.slice(0, -2), entry.name))
    : [pattern]
  for (const directory of directories) {
    let pkg
    try {
      pkg = JSON.parse(
        readFileSync(join(root, directory, 'package.json'), 'utf8'),
      )
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    packages.set(pkg.name, { ...pkg, directory })
  }
}
const visited = new Set()
const visiting = new Set()
function run(name) {
  if (visited.has(name)) return
  if (visiting.has(name))
    throw new Error(`Workspace dependency cycle at ${name}`)
  visiting.add(name)
  const pkg = packages.get(name)
  for (const dependency of Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.optionalDependencies,
  }).sort()) {
    if (packages.has(dependency)) run(dependency)
  }
  visiting.delete(name)
  visited.add(name)
  if (!pkg.scripts?.[task]) return
  const result = spawnSync('bun', ['run', task], {
    cwd: join(root, pkg.directory),
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
for (const name of [...packages.keys()].sort()) run(name)
