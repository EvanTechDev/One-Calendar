import { spawnSync } from 'node:child_process'
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
const original = readFileSync(configPath, 'utf8')
const config = JSON.parse(original)
config.provider = {
  ...config.provider,
  // This adapter uses Chat Completions and supports Lingo's baseUrl option.
  // The explicit URL sends requests to the configured service, not OpenRouter.
  id: 'openrouter',
  baseUrl: baseUrl.href.replace(/\/+$/, ''),
  model: process.env.TRANSLATION_MODEL.trim(),
}

try {
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  const result = spawnSync('pnpm', ['dlx', 'lingo.dev@0.138.9', 'run'], {
    cwd: directory,
    stdio: 'inherit',
    env: {
      ...process.env,
      OPENROUTER_API_KEY: process.env.TRANSLATION_API_KEY.trim(),
    },
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  // Keep endpoint/model overrides out of the generated translation commit.
  // Credentials exist only in the child process environment.
  writeFileSync(configPath, original)
}
