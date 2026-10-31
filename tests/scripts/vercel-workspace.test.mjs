import assert from 'node:assert/strict'
import { afterEach, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const repository = readJson(new URL('../../package.json', import.meta.url))
const calendar = readJson(
  new URL('../../apps/calendar/package.json', import.meta.url),
)
const vercel = readJson(
  new URL('../../apps/calendar/vercel.json', import.meta.url),
)
const temporaryRoots = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'zentra-vercel-workspace-'))
  temporaryRoots.push(root)
  const app = join(root, 'apps/calendar')
  mkdirSync(app, { recursive: true })
  writeFileSync(
    join(app, 'package.json'),
    JSON.stringify({
      name: calendar.name,
      dependencies: Object.fromEntries(
        ['@zntr/auth', '@zntr/i18n'].map((name) => [
          name,
          calendar.dependencies[name],
        ]),
      ),
    }),
  )
  return { root, app }
}

const install = (cwd, args) =>
  spawnSync(process.execPath, ['install', ...args], { cwd, encoding: 'utf8' })

test('an app-only deployment reproduces the missing workspace errors', () => {
  const { app } = fixture()
  const result = install(app, ['--lockfile-only', '--ignore-scripts'])
  assert.notEqual(result.status, 0)
  for (const name of ['@zntr/auth', '@zntr/i18n'])
    assert.ok(
      result.stderr.includes(`Workspace dependency "${name}" not found`),
    )
})

test('Calendar deployment installs from the workspace root using its frozen lockfile', () => {
  assert.equal(typeof vercel.installCommand, 'string')
  const { root, app } = fixture()
  writeFileSync(
    join(root, 'bunfig.toml'),
    readFileSync(new URL('../../bunfig.toml', import.meta.url), 'utf8'),
  )
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ private: true, workspaces: repository.workspaces }),
  )
  // Literal workspace paths must exist, even when this fixture has no docs deps.
  for (const path of repository.workspaces.filter(
    (path) => !path.includes('*'),
  )) {
    const manifest = readJson(
      new URL(`../../${path}/package.json`, import.meta.url),
    )
    const directory = join(root, path)
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({ name: manifest.name, version: '1.0.0' }),
    )
  }
  for (const name of ['auth', 'i18n']) {
    const manifest = readJson(
      new URL(`../../packages/${name}/package.json`, import.meta.url),
    )
    const directory = join(root, 'packages', name)
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({ name: manifest.name, version: '1.0.0' }),
    )
  }
  const lock = install(root, ['--lockfile-only', '--ignore-scripts'])
  assert.equal(lock.status, 0, lock.stdout + lock.stderr)
  const originalLock = readFileSync(join(root, 'bun.lock'), 'utf8')
  const result = spawnSync(vercel.installCommand, {
    shell: true,
    cwd: app,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(readFileSync(join(root, 'bun.lock'), 'utf8'), originalLock)
  assert.equal(existsSync(join(app, 'bun.lock')), false)
  for (const name of ['auth', 'i18n'])
    assert.equal(
      readJson(join(root, 'node_modules/@zntr', name, 'package.json')).name,
      `@zntr/${name}`,
    )
})
