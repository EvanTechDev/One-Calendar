const ROOM_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function randomString(length: number): string {
  let out = ''
  const values = new Uint32Array(length)
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(values)
  } else {
    for (let i = 0; i < length; i++) {
      values[i] = Math.floor(Math.random() * ROOM_ID_ALPHABET.length)
    }
  }
  for (let i = 0; i < length; i++) {
    out += ROOM_ID_ALPHABET[values[i] % ROOM_ID_ALPHABET.length]
  }
  return out
}

export function encodePassphrase(passphrase: string): string {
  return encodeURIComponent(passphrase)
}

export function decodePassphrase(encoded: string): string {
  return decodeURIComponent(encoded)
}

export function generatePassphrase(length = 64): string {
  return randomString(length)
}

export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.hardwareConcurrency < 6
}

/**
 * Rewrites a LiveKit Cloud URL to pin a regional edge, e.g.
 * `wss://my-project.livekit.cloud` + `eu` →
 * `wss://my-project.eu.production.livekit.cloud`.
 * Non-cloud URLs are returned unchanged.
 */
export function resolveRegionalUrl(
  projectUrl: string,
  region: string | null | undefined,
): string {
  const url = new URL(projectUrl)
  if (region && url.hostname.endsWith('livekit.cloud')) {
    const [projectId, ...rest] = url.hostname.split('.')
    const hostParts = rest[0] === 'staging' ? rest : ['production', ...rest]
    url.hostname = [projectId, region, ...hostParts].join('.')
  }
  return url.toString()
}
