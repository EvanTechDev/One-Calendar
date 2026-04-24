import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, importPKCS8, importSPKI, jwtVerify } from 'jose'

const ACCESS_TTL = 60 * 60
const REFRESH_TTL = 60 * 60 * 24 * 30

function getPrivateKeyPem() {
  return process.env.DS_ES256_PRIVATE_KEY_PEM?.trim()
}

function getPublicKeyPem() {
  return process.env.DS_ES256_PUBLIC_KEY_PEM?.trim()
}

const generated = (() => {
  if (getPrivateKeyPem() && getPublicKeyPem()) return null
  const { generateKeyPairSync } = require('node:crypto') as typeof import('node:crypto')
  const kp = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  return {
    privateKey: kp.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKey: kp.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  }
})()

function privatePem() {
  return getPrivateKeyPem() ?? generated?.privateKey ?? ''
}

function publicPem() {
  return getPublicKeyPem() ?? generated?.publicKey ?? ''
}

export function validatePkceVerifier(verifier: string) {
  return verifier.length >= 43 && verifier.length <= 128
}

export function verifyCodeChallenge(verifier: string, challenge: string) {
  const digest = createHash('sha256').update(verifier).digest('base64url')
  return digest === challenge
}

export function randomToken(size = 32) {
  return randomBytes(size).toString('base64url')
}

export async function signToken(payload: {
  sub: string
  client_id: string
  iss: string
  scope: string
  type: 'access' | 'refresh'
  jti?: string
}) {
  const pk = await importPKCS8(privatePem(), 'ES256')
  const ttl = payload.type === 'access' ? ACCESS_TTL : REFRESH_TTL
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256' })
    .setSubject(payload.sub)
    .setIssuer(payload.iss)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .setJti(payload.jti ?? randomToken(16))
    .sign(pk)
}

export async function verifyToken(token: string, issuer: string) {
  const pub = await importSPKI(publicPem(), 'ES256')
  const result = await jwtVerify(token, pub, { issuer })
  return result.payload
}
