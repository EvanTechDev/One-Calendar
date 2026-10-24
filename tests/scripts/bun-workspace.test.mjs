import assert from 'node:assert/strict'
import { afterEach, test } from 'bun:test'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const temporaryRoots = []
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

test('build runner preserves dependency order and skips absent scripts', () => {
  const root = mkdtempSync(join(tmpdir(), 'zentra-bun-workspaces-'))
  temporaryRoots.push(root)
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      private: true,
      workspaces: ['packages/*'],
    }),
  )
  for (const [name, dependencies, scripts] of [
    ['a-app', { 'z-shared': 'workspace:*' }, { check: 'bun check.mjs' }],
    ['z-shared', {}, { check: 'bun check.mjs' }],
    ['no-check', {}, {}],
  ]) {
    const dir = join(root, 'packages', name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name, version: '1.0.0', dependencies, scripts }),
    )
    writeFileSync(
      join(dir, 'check.mjs'),
      `import { appendFileSync } from 'node:fs'; appendFileSync('../../order', '${name}\\n')`,
    )
  }
  const install = spawnSync(
    'bun',
    ['install', '--lockfile-only', '--ignore-scripts'],
    { cwd: root, encoding: 'utf8' },
  )
  assert.equal(install.status, 0, install.stdout + install.stderr)
  const result = spawnSync(
    'bun',
    [
      new URL('../../scripts/workspaces.mjs', import.meta.url).pathname,
      'check',
    ],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(readFileSync(join(root, 'order'), 'utf8'), 'z-shared\na-app\n')
  const filtered = spawnSync(
    'bun',
    ['run', '--sequential', '--workspaces', '--if-present', 'check'],
    { cwd: root, encoding: 'utf8' },
  )
  assert.equal(filtered.status, 0, filtered.stdout + filtered.stderr)
})
