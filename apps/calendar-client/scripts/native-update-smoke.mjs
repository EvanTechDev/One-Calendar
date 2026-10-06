import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { install, linuxEnvironment } from './native-smoke.mjs'

const assets = resolve('update-acceptance-assets')
const reports = resolve('update-acceptance-artifacts')
mkdirSync(reports, { recursive: true })
const reportPath = resolve(reports, 'installed-update.jsonl')
writeFileSync(reportPath, '')
const fragment = JSON.parse(
  readFileSync(resolve(assets, 'target.json'), 'utf8'),
)
const bytes = readFileSync(resolve(assets, fragment.asset))
let downloads = 0
const server = createServer((request, response) => {
  if (request.url === '/latest.json') {
    response.setHeader('Content-Type', 'application/json')
    response.end(
      JSON.stringify({
        version: '0.0.2',
        notes: 'Isolated signed updater acceptance',
        pub_date: new Date().toISOString(),
        platforms: {
          [fragment.platform]: {
            signature: fragment.signature,
            url: `http://127.0.0.1:${server.address().port}/artifact`,
          },
        },
      }),
    )
  } else if (request.url === '/artifact') {
    downloads++
    const body = downloads === 1 ? Buffer.from(bytes) : bytes
    if (downloads === 1) body[Math.floor(body.length / 2)] ^= 1
    response.setHeader('Content-Length', body.length)
    response.end(body)
  } else {
    response.writeHead(404).end()
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const executable = install()
const child = spawn(executable, [], {
  env: {
    ...process.env,
    ...(process.platform === 'linux' ? linuxEnvironment : {}),
    ZENTRA_UPDATE_ACCEPTANCE_ENDPOINT: `http://127.0.0.1:${server.address().port}/latest.json`,
    ZENTRA_UPDATE_ACCEPTANCE_REPORT: reportPath,
    ZENTRA_UPDATE_ACCEPTANCE_SENTINEL: randomUUID(),
  },
  detached: process.platform !== 'win32',
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
let spawnError
child.once('error', (error) => {
  spawnError = error
})
child.stdout.on('data', (chunk) => {
  output += chunk
})
child.stderr.on('data', (chunk) => {
  output += chunk
})
let records = []
try {
  const deadline = Date.now() + 240_000
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError
    // Ignore an incomplete final write; each complete line is a durable report.
    if (existsSync(reportPath))
      records = readFileSync(reportPath, 'utf8')
        .split('\n')
        .slice(0, -1)
        .filter(Boolean)
        .map(JSON.parse)
    const failed = records.find((entry) => entry.phase === 'failed')
    assert(!failed, failed?.error)
    if (records.some((entry) => entry.phase === 'upgraded')) break
    await setTimeout(100)
  }
  const first = records.find((entry) => entry.phase === 'started')
  const last = records.find((entry) => entry.phase === 'upgraded')
  assert(last, 'Signed update did not restart into version B')
  assert.equal(first.version, '0.0.1')
  assert.equal(last.version, '0.0.2')
  assert.equal(
    last.executable,
    first.executable,
    'Update changed the installation location',
  )
  assert.equal(
    last.appData,
    first.appData,
    'Update changed the application data directory',
  )
  assert.equal(
    last.identifier,
    process.env.ZENTRA_DESKTOP_ENV === 'dev'
      ? 'app.zntr.calendar.dev'
      : 'app.zntr.calendar',
  )
  assert(records.some((entry) => entry.phase === 'invalid-signature-rejected'))
  assert.equal(
    downloads,
    2,
    'Expected a rejected download followed by a successful retry',
  )
  console.log(
    'Installed signed update, signature rejection, retry, restart and data retention passed',
  )
} finally {
  writeFileSync(resolve(reports, 'application.log'), output)
  for (const pid of new Set(
    [child.pid, ...records.map((entry) => entry.pid)].filter(Boolean),
  )) {
    try {
      if (process.platform === 'win32')
        execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
          stdio: 'ignore',
        })
      else process.kill(pid, 'SIGTERM')
    } catch {
      /* Owned process already exited. */
    }
  }
  server.closeAllConnections()
  await new Promise((done) => server.close(done))
}
