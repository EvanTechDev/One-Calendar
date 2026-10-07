import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const required = [
  'TRANSLATION_BASE_URL',
  'TRANSLATION_API_KEY',
  'TRANSLATION_MODEL',
]
const missing = required.filter((name) => !process.env[name]?.trim())
if (missing.length) {
  throw new Error(`Missing translation configuration: ${missing.join(', ')}`)
}

const concurrency = Number(process.env.TRANSLATION_CONCURRENCY ?? 3)
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) {
  throw new Error('TRANSLATION_CONCURRENCY must be an integer between 1 and 10')
}

const baseUrl = new URL(process.env.TRANSLATION_BASE_URL.trim())
if (
  !['https:', 'http:'].includes(baseUrl.protocol) ||
  baseUrl.username ||
  baseUrl.password ||
  baseUrl.search ||
  baseUrl.hash
) {
  throw new Error('Translation base URL must be an HTTP(S) API base URL')
}
if (/\/chat\/completions\/?$/.test(baseUrl.pathname)) {
  throw new Error(
    'Use the API base URL (usually ending in /v1), not /chat/completions',
  )
}

const directory = fileURLToPath(new URL('../', import.meta.url))
const configPath = new URL('../i18n.json', import.meta.url)
const lockPath = new URL('../i18n.lock', import.meta.url)
const original = readFileSync(configPath, 'utf8')
const originalLock = readFileSync(lockPath, 'utf8')
const config = JSON.parse(original)
const locales = [
  ...new Set(
    (process.env.TRANSLATION_LOCALES ?? '')
      .split(',')
      .map((locale) => locale.trim())
      .filter(Boolean),
  ),
]
for (const locale of locales) {
  if (!config.locale.targets.includes(locale)) {
    throw new Error(`Unknown translation target: ${locale}`)
  }
}
const checksumRef = process.env.TRANSLATION_CHECKSUM_REF?.trim()
let retryLock
if (checksumRef) {
  if (!/^[a-f0-9]{7,40}$/i.test(checksumRef) || !locales.length) {
    throw new Error(
      'A checksum reference requires a commit SHA and explicit target locales',
    )
  }
  retryLock = execFileSync(
    'git',
    ['show', `${checksumRef}:packages/i18n/i18n.lock`],
    {
      cwd: directory,
      encoding: 'utf8',
    },
  )
  JSON.parse(retryLock)
}
config.provider = {
  ...config.provider,
  // This adapter uses Chat Completions and supports Lingo's baseUrl option.
  // The explicit URL sends requests to the configured service, not OpenRouter.
  id: 'openrouter',
  baseUrl: baseUrl.href.replace(/\/+$/, ''),
  model: process.env.TRANSLATION_MODEL.trim(),
}

let succeeded = false
try {
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  if (retryLock) writeFileSync(lockPath, retryLock)
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'lingo.dev',
      'run',
      '--concurrency',
      String(concurrency),
      ...locales.flatMap((locale) => ['--target-locale', locale]),
    ],
    {
      cwd: directory,
      stdio: 'inherit',
      env: {
        ...process.env,
        OPENROUTER_API_KEY: process.env.TRANSLATION_API_KEY.trim(),
      },
    },
  )
  if (result.error) throw result.error
  succeeded = result.status === 0
  process.exitCode = result.status ?? 1
} finally {
  // Keep endpoint/model overrides out of the generated translation commit.
  // Credentials exist only in the child process environment.
  writeFileSync(configPath, original)
  // Lingo advances global checksums even when individual locales fail. Keep
  // the previous checkpoint so changed existing keys remain eligible on retry.
  // Targeted retries must never alter the checkpoint for other locales.
  if (!succeeded || locales.length) writeFileSync(lockPath, originalLock)
}
