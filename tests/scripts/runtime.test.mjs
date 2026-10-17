import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'zntr-runtime-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'scripts'))
  cpSync(
    new URL('../../scripts/runtime.mjs', import.meta.url),
    join(root, 'scripts/runtime.mjs'),
  )
  for (const app of ['calendar', 'meet']) {
    mkdirSync(join(root, 'apps', app), { recursive: true })
    writeFileSync(
      join(root, 'apps', app, 'package.json'),
      JSON.stringify(
        {
          name: app,
          scripts: {
            dev: app === 'meet' ? 'next dev -p 3001' : 'next dev',
            build:
              app === 'calendar'
                ? 'pnpm generate:i18n && pnpm mdx && next build'
                : 'next build',
            start: app === 'meet' ? 'next start -p 3001' : 'next start',
            test: 'vitest run',
          },
          dependencies: { next: '16.3.8' },
        },
        null,
        2,
      ) + '\n',
    )
    writeFileSync(
      join(root, 'apps', app, 'vercel.json'),
      JSON.stringify(
        {
          $schema: 'https://openapi.vercel.sh/vercel.json',
          ...(app === 'calendar'
            ? {
                functions: {
                  'app/api/agent/chat/route.ts': { supportsCancellation: true },
                },
                crons: [{ path: '/api/blob/check', schedule: '0 0 * * *' }],
              }
            : {}),
        },
        null,
        2,
      ) + '\n',
    )
  }
  return {
    run: (...args) =>
      spawnSync(
        process.execPath,
        [join(root, 'scripts/runtime.mjs'), ...args],
        {
          cwd: tmpdir(),
          encoding: 'utf8',
        },
      ),
    read: (app, file) => readFileSync(join(root, 'apps', app, file), 'utf8'),
    write: (app, file, content) =>
      writeFileSync(join(root, 'apps', app, file), content),
  }
}

test('switches both apps to Bun and back without losing app configuration', (t) => {
  const f = fixture(t)
  const original = Object.fromEntries(
    ['calendar', 'meet'].map((app) => [
      app,
      {
        package: f.read(app, 'package.json'),
        vercel: f.read(app, 'vercel.json'),
      },
    ]),
  )
  const result = f.run('bun')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(f.read('calendar', 'vercel.json')).bunVersion, '1.x')
  assert.equal(JSON.parse(f.read('meet', 'vercel.json')).bunVersion, '1.x')
  assert.equal(
    JSON.parse(f.read('calendar', 'package.json')).scripts.build,
    'pnpm generate:i18n && pnpm mdx && bun run --bun next build',
  )
  assert.equal(
    JSON.parse(f.read('meet', 'package.json')).scripts.start,
    'bun run --bun next start -p 3001',
  )
  const back = f.run('node')
  assert.equal(back.status, 0, back.stderr)
  for (const app of ['calendar', 'meet']) {
    assert.equal(f.read(app, 'package.json'), original[app].package)
    assert.equal(f.read(app, 'vercel.json'), original[app].vercel)
  }
})

test('status detects mixed configuration without modifying files', (t) => {
  const f = fixture(t)
  const original = f.read('calendar', 'package.json')
  const node = f.run('status')
  assert.equal(node.status, 0, node.stderr)
  assert.match(node.stdout, /calendar: Node\.js/)
  assert.match(node.stdout, /meet: Node\.js/)
  assert.equal(f.read('calendar', 'package.json'), original)
  f.write('meet', 'vercel.json', '{"bunVersion":"1.x"}\n')
  const mixed = f.run('status')
  assert.equal(mixed.status, 1)
  assert.match(mixed.stdout, /mixed/i)
  assert.match(mixed.stdout, /Bun \(1.x\)/)
})

test('repeated switches are no-ops and preserve custom prerequisite commands', (t) => {
  const f = fixture(t)
  const pkg = JSON.parse(f.read('calendar', 'package.json'))
  pkg.scripts.build = 'pnpm custom-prebuild && next build --webpack'
  const compact = JSON.stringify(pkg) + '\n'
  f.write('calendar', 'package.json', compact)
  assert.equal(f.run('node').status, 0)
  assert.equal(f.read('calendar', 'package.json'), compact)
  assert.equal(f.run('bun').status, 0)
  const bun = f.read('calendar', 'package.json')
  assert.equal(
    JSON.parse(bun).scripts.build,
    'pnpm custom-prebuild && bun run --bun next build --webpack',
  )
  assert.equal(f.run('bun').status, 0)
  assert.equal(f.read('calendar', 'package.json'), bun)
  assert.equal(f.run('status').status, 0)
})

test('unsupported commands or malformed JSON fail before either app is modified', (t) => {
  const f = fixture(t)
  const calendar = f.read('calendar', 'package.json')
  const vercel = f.read('calendar', 'vercel.json')
  const pkg = JSON.parse(f.read('meet', 'package.json'))
  pkg.scripts.start = 'node custom-server.mjs'
  const custom = JSON.stringify(pkg)
  f.write('meet', 'package.json', custom)
  const invalidScript = f.run('bun')
  assert.equal(invalidScript.status, 1)
  assert.match(invalidScript.stderr, /unsupported scripts.start/)
  assert.equal(f.read('calendar', 'package.json'), calendar)
  assert.equal(f.read('calendar', 'vercel.json'), vercel)
  assert.equal(f.read('meet', 'package.json'), custom)
  f.write('meet', 'vercel.json', '{broken')
  assert.equal(f.run('bun').status, 1)
  assert.equal(f.read('calendar', 'package.json'), calendar)
})

test('supports explicit Bun versions and rejects invalid arguments without changes', (t) => {
  const f = fixture(t)
  const original = f.read('calendar', 'vercel.json')
  for (const args of [
    [],
    ['unknown'],
    ['bun', '--bun-version', 'latest'],
    ['node', '--bun-version', '1.x'],
  ]) {
    assert.equal(f.run(...args).status, 1)
    assert.equal(f.read('calendar', 'vercel.json'), original)
  }
  const bun = f.run('bun', '--bun-version', '1.4.x')
  assert.equal(bun.status, 0, bun.stderr)
  assert.equal(
    JSON.parse(f.read('calendar', 'vercel.json')).bunVersion,
    '1.4.x',
  )
  assert.equal(JSON.parse(f.read('meet', 'vercel.json')).bunVersion, '1.4.x')
  const status = f.run('status')
  assert.equal(status.status, 0, status.stderr)
  assert.match(status.stdout, /Bun \(1.4.x\)/)
  assert.equal(f.run('help').status, 0)
})
