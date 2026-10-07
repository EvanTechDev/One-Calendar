import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'translation-checkpoint-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const directory = join(root, 'packages/i18n')
  const bin = join(root, 'bin')
  mkdirSync(join(directory, 'src'), { recursive: true })
  mkdirSync(bin)
  copyFileSync(
    new URL('../../packages/i18n/src/translate.mjs', import.meta.url),
    join(directory, 'src/translate.mjs'),
  )
  const originalConfig = JSON.stringify({
    locale: { targets: ['el', 'bn'] },
    provider: { id: 'mistral', prompt: 'Keep placeholders.' },
  })
  const originalLock = readFileSync(
    new URL('../../packages/i18n/i18n.lock', import.meta.url),
    'utf8',
  )
  writeFileSync(join(directory, 'i18n.json'), originalConfig)
  writeFileSync(join(directory, 'i18n.lock'), originalLock)
  // Exercise the actual wrapper; only the external translator is replaced.
  writeFileSync(
    join(bin, 'pnpm'),
    `#!/usr/bin/env node
const fs = require('node:fs')
fs.writeFileSync('request.json', JSON.stringify({
  args: process.argv.slice(2), config: JSON.parse(fs.readFileSync('i18n.json', 'utf8')),
  lock: fs.readFileSync('i18n.lock', 'utf8'), hasKey: !!process.env.OPENROUTER_API_KEY,
}))
fs.writeFileSync('completed-locale.json', '{"title":"Translated"}')
fs.writeFileSync('i18n.lock', 'version: 1\\nchecksums: {}\\n')
process.exit(Number(process.env.FAKE_EXIT ?? 0))
`,
    { mode: 0o755 },
  )
  return {
    originalConfig,
    originalLock,
    read: (name) => readFileSync(join(directory, name), 'utf8'),
    git: (...args) =>
      execFileSync(
        'git',
        [
          '-c',
          'user.name=Fixture',
          '-c',
          'user.email=fixture@example.com',
          ...args,
        ],
        { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ).trim(),
    writeLock: (value) => writeFileSync(join(directory, 'i18n.lock'), value),
    run: (env = {}) =>
      spawnSync(process.execPath, [join(directory, 'src/translate.mjs')], {
        cwd: directory,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          TRANSLATION_BASE_URL: 'https://api.example.com/v1',
          TRANSLATION_MODEL: 'test-model',
          TRANSLATION_API_KEY: 'test-only-key',
          TRANSLATION_CONCURRENCY: '1',
          TRANSLATION_LOCALES: '',
          TRANSLATION_CHECKSUM_REF: '',
          FAKE_EXIT: '0',
          ...env,
        },
      }),
  }
}

test('successful full translation advances checksums and restores provider configuration', (t) => {
  const f = fixture(t)
  const result = f.run()
  assert.equal(result.status, 0, result.stderr)
  assert.equal(f.read('i18n.json'), f.originalConfig)
  assert.equal(f.read('i18n.lock'), 'version: 1\nchecksums: {}\n')
  const request = JSON.parse(f.read('request.json'))
  assert.equal(request.config.provider.baseUrl, 'https://api.example.com/v1')
  assert.equal(request.config.provider.prompt, 'Keep placeholders.')
  assert.equal(request.hasKey, true)
  assert(!JSON.stringify(request.config).includes('test-only-key'))
})

test('partial failure retains completed output without advancing global checksums', (t) => {
  const f = fixture(t)
  assert.equal(f.run({ FAKE_EXIT: '1' }).status, 1)
  assert.equal(f.read('i18n.json'), f.originalConfig)
  assert.equal(f.read('i18n.lock'), f.originalLock)
  assert.equal(JSON.parse(f.read('completed-locale.json')).title, 'Translated')
})

test('targeted retry uses historic checksums and preserves the current checkpoint', (t) => {
  const f = fixture(t)
  f.git('init')
  const historicLock =
    '# Before the failed translation\nversion: 1\nchecksums: {}\n'
  f.writeLock(historicLock)
  f.git('add', 'packages/i18n/i18n.lock')
  f.git('commit', '-m', 'fixture')
  const ref = f.git('rev-parse', 'HEAD')
  f.writeLock(f.originalLock)
  const result = f.run({
    TRANSLATION_LOCALES: 'el,bn,el',
    TRANSLATION_CHECKSUM_REF: ref,
  })
  assert.equal(result.status, 0, result.stderr)
  const request = JSON.parse(f.read('request.json'))
  assert.equal(request.lock, historicLock)
  assert.deepEqual(request.args, [
    'exec',
    'lingo.dev',
    'run',
    '--concurrency',
    '1',
    '--target-locale',
    'el',
    '--target-locale',
    'bn',
  ])
  assert.equal(f.read('i18n.lock'), f.originalLock)
})

test('unknown locales are rejected before invoking the translator', (t) => {
  const f = fixture(t)
  const result = f.run({ TRANSLATION_LOCALES: 'unknown' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Unknown translation target/)
  assert.equal(f.read('i18n.json'), f.originalConfig)
  assert.equal(f.read('i18n.lock'), f.originalLock)
  assert.throws(() => f.read('request.json'), { code: 'ENOENT' })
})
