import assert from 'node:assert/strict'
import { afterEach, test } from 'bun:test'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
)
const config = readFileSync(
  new URL('../../bunfig.toml', import.meta.url),
  'utf8',
)
const temporaryRoots = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

test('format scripts and staged tasks use the native formatter', () => {
  assert.equal(packageJson.scripts.format, 'bun fmt')
  assert.equal(packageJson.scripts['format:check'], 'bun fmt --check')
  assert.equal(packageJson.devDependencies.prettier, undefined)
  assert.equal(packageJson.prettier, undefined)
  for (const tasks of Object.values(packageJson['lint-staged'])) {
    assert.equal(tasks[0], 'bun fmt')
    assert.ok(tasks.every((task) => !task.includes('prettier')))
  }
})

test('native formatting preserves style, exclusions and nested configuration', () => {
  const root = mkdtempSync(join(tmpdir(), 'zentra-bun-format-'))
  temporaryRoots.push(root)
  const put = (path, content) => {
    const fullPath = join(root, path)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, content)
  }
  const source =
    'import z from "z";\nimport a from "a";\nexport const value={label:"hello",items:[1,2]};\n'
  put('bunfig.toml', config)
  put('.gitignore', 'generated/\n')
  put('apps/example/source.ts', source)
  const ignored = [
    'packages/ui/src/vendored.ts',
    'packages/i18n/locales/en.json',
    'apps/example/dist/bundle.js',
    'generated/output.ts',
    'bun.lock',
  ]
  for (const path of ignored) put(path, source)
  const run = (...args) => {
    const result = spawnSync(process.execPath, ['fmt', ...args], {
      cwd: root,
      encoding: 'utf8',
    })
    assert.equal(result.error, undefined)
    return result
  }
  assert.equal(run('--check').status, 1)
  const formatted = run()
  assert.equal(formatted.status, 0, formatted.stdout + formatted.stderr)
  const output = readFileSync(join(root, 'apps/example/source.ts'), 'utf8')
  assert.match(output, /label: 'hello'/)
  assert.ok(!output.includes(';'))
  assert.ok(output.indexOf("from 'z'") < output.indexOf("from 'a'"))
  for (const path of ignored)
    assert.equal(readFileSync(join(root, path), 'utf8'), source)
  // lint-staged passes explicit paths; exclusions must still apply to those.
  assert.equal(run('--check', ...ignored).status, 0)
  assert.equal(run('--check').status, 0)
  const nested = spawnSync(process.execPath, ['fmt', '--check', 'source.ts'], {
    cwd: join(root, 'apps/example'),
    encoding: 'utf8',
  })
  assert.equal(nested.status, 0, nested.stdout + nested.stderr)
  assert.equal(
    readFileSync(join(root, 'apps/example/source.ts'), 'utf8'),
    output,
  )
})
