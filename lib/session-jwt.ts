import { createHmac, timingSafeEqual } from "crypto"

const encoder = new TextEncoder()

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function base64UrlDecode(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4)
  return Buffer.from(padded, "base64")
}

function sign(data: string, secret: string) {
  return base64UrlEncode(createHmac("sha256", secret).update(data).digest())
}

export type SessionPayload = {
  sub: string
  keyHash: string
  exp: number
}

export function createSessionToken(payload: SessionPayload, secret: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = base64UrlEncode(JSON.stringify(payload))
  const message = `${header}.${body}`
  const signature = sign(message, secret)
  return `${message}.${signature}`
}

export function verifySessionToken(token: string, secret: string): SessionPayload | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null

  const [header, body, signature] = parts
  const message = `${header}.${body}`
  const expectedSig = sign(message, secret)

  const sigBuf = encoder.encode(signature)
  const expectedBuf = encoder.encode(expectedSig)

  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null

  try {
    const payload = JSON.parse(base64UrlDecode(body).toString("utf8")) as SessionPayload
    if (!payload?.sub || !payload?.keyHash || typeof payload.exp !== "number") return null
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
