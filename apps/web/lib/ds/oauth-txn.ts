import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'ds_oauth_txn'

export interface DsOauthTxn {
  state: string
  codeVerifier: string
  dsIssuer: string
  createdAt: number
}

function randomUrlSafe(length = 32) {
  return randomBytes(length).toString('base64url')
}

export function createPkcePair() {
  const verifier = randomUrlSafe(48)
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export async function persistTxn(txn: DsOauthTxn) {
  const store = await cookies()
  store.set(COOKIE_NAME, Buffer.from(JSON.stringify(txn), 'utf8').toString('base64url'), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60,
  })
}

export async function readTxn() {
  const store = await cookies()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as DsOauthTxn
    return parsed
  } catch {
    return null
  }
}

export async function clearTxn() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export function randomState() {
  return randomUrlSafe(24)
}
