// Run on an isolated CI browser against an explicitly selected Vercel deployment.
// Uses an empty sign-in body: never creates an account, sends mail or logs in.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const origin = new URL(process.env.BOTID_ORIGIN)
assert.equal(origin.protocol, 'https:')
const path = '/api/auth/sign-in/email'
const output = 'artifacts/bot-id'
await mkdir(output, { recursive: true })

const machine = await fetch(new URL(path, origin), {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: origin.origin },
  body: '{}',
})
const machineBody = await machine.json()
assert.equal(machine.status, 403, 'An uninstrumented request must be blocked')
assert.equal(machineBody.error, 'BOT_DETECTED')

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  const requests = []
  await page.addInitScript(() => {
    window.botViolations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      if (`${event.blockedURI} ${event.sourceFile}`.includes('/149e9513-')) {
        window.botViolations.push({
          directive: event.effectiveDirective,
          blocked: new URL(event.blockedURI, location.href).pathname,
        })
      }
    })
  })
  page.on('request', (request) => {
    if (new URL(request.url()).pathname !== path || request.method() !== 'POST')
      return
    const headers = request.headers()
    // Record presence only; the proof itself must never appear in artifacts.
    requests.push({
      proof: Boolean(headers['x-is-human']),
      path: headers['x-path'],
      method: headers['x-method'],
    })
  })
  await page.goto(new URL('/sign-in', origin).href, {
    waitUntil: 'networkidle',
  })
  await page.waitForSelector('input[type="password"]')
  const response = await page.evaluate(async (endpoint) => {
    const result = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    return { status: result.status, body: await result.json() }
  }, path)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].proof, true, 'The browser SDK must attach its proof')
  assert.equal(requests[0].path, path)
  assert.equal(requests[0].method, 'POST')
  // BotID may correctly classify an automated browser as a bot. A human result
  // reaches Better Auth, which rejects this intentionally empty credential body.
  assert([400, 403].includes(response.status), JSON.stringify(response))
  if (response.status === 403) assert.equal(response.body.error, 'BOT_DETECTED')
  const violations = await page.evaluate(() => window.botViolations)
  assert.deepEqual(violations, [], 'BotID must not be blocked by the page CSP')
  await page.screenshot({ path: `${output}/sign-in.png`, fullPage: true })
  await writeFile(
    `${output}/result.json`,
    JSON.stringify(
      {
        origin: origin.origin,
        machineStatus: machine.status,
        instrumentation: requests[0],
        browserStatus: response.status,
        reachedCredentialValidation: response.status === 400,
        violations,
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
