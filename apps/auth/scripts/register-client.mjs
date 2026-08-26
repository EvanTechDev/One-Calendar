/**
 * Registers a first-party OAuth client.
 *
 * Run server-side only. The `/admin/oauth2/*` endpoints this uses are refused by
 * the HTTP route on purpose (see @zntr/auth/route-policy): they can set
 * `skip_consent` and assign a machine-to-machine scope ceiling, so reaching them
 * over the network would be an account-takeover primitive rather than a
 * convenience.
 *
 * Usage, from apps/auth:
 *
 *   node scripts/register-client.mjs \
 *     --name "Zentra Calendar" \
 *     --redirect https://cal.example.com/api/auth/callback/zentra
 *
 * Prints the client id and secret ONCE. The secret is stored hashed, so it
 * cannot be recovered afterwards — only rotated.
 */
import fs from 'node:fs'
import path from 'node:path'

function arg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function loadEnv() {
  // Read .env.local the way Next does, so the script and the app agree about
  // which database and which issuer they mean.
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '../../.env.local'),
  ]
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^([A-Z_0-9]+)="?([^"\n]*)"?$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
    }
  }
}

const name = arg('name')
const redirect = arg('redirect')

if (!name || !redirect) {
  console.error(
    'usage: node scripts/register-client.mjs --name "<name>" --redirect <uri> [--redirect <uri>]',
  )
  process.exit(1)
}

// Every --redirect, not just the first: an app usually needs at least a
// production and a preview callback.
const redirectUris = process.argv.reduce((uris, value, index) => {
  if (value === '--redirect' && process.argv[index + 1]) {
    uris.push(process.argv[index + 1])
  }
  return uris
}, [])

loadEnv()

for (const required of ['BETTER_AUTH_SECRET', 'NEXT_PUBLIC_BASE_URL']) {
  if (!process.env[required]) {
    console.error(`${required} is not set; cannot register a client`)
    process.exit(1)
  }
}

const { getPortal } = await import('../lib/auth.ts')

// A confidential client: our apps are Next.js servers and can hold a secret, so
// there is no reason to register a public one. `skip_consent` because a
// first-party app showing a consent screen for its own product is noise, not
// disclosure.
const created = await getPortal().auth.api.adminCreateOAuthClient({
  body: {
    client_name: name,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: 'client_secret_basic',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'openid profile email offline_access',
    skip_consent: true,
    enable_end_session: true,
    application_type: 'web',
  },
})

console.log('\nClient registered. Store the secret now — it cannot be read again.\n')
console.log(`  AUTH_CLIENT_ID=${created.client_id}`)
console.log(`  AUTH_CLIENT_SECRET=${created.client_secret}`)
console.log(`\n  redirect_uris: ${redirectUris.join(', ')}\n`)
