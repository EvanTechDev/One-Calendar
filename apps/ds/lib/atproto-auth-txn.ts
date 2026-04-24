import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'ds_atproto_oauth_txn'

export interface DsAtprotoAuthTxn {
  state: string
  codeVerifier: string
  handle: string
  did: string
  pds: string
  source: 'local' | 'web'
  webOauth?: {
    clientId: string
    redirectUri: string
    codeChallenge: string
    state: string
    scope: string
  }
}

function randomToken(size = 32) {
  return randomBytes(size).toString('base64url')
}

export function createPkcePair() {
  const codeVerifier = randomToken(48)
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

export async function setTxn(txn: DsAtprotoAuthTxn) {
  const store = await cookies()
  store.set(COOKIE_NAME, Buffer.from(JSON.stringify(txn), 'utf8').toString('base64url'), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  })
}

export async function getTxn() {
  const store = await cookies()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as DsAtprotoAuthTxn
  } catch {
    return null
  }
}

export async function clearTxn() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export function randomState() {
  return randomToken(24)
}
