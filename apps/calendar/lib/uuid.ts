/**
 * crypto.randomUUID() requires a secure context — on plain-http origins
 * (e.g. a dev server reached through a LAN IP) it is undefined and calling
 * it throws synchronously. Save flows must never die on id generation, so
 * fall back to a getRandomValues-based v4 (available in insecure contexts)
 * and finally to Math.random.
 */
export function uuid(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (typeof c?.getRandomValues === 'function') {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  const b6 = bytes[6] ?? 0
  const b8 = bytes[8] ?? 0
  bytes[6] = (b6 & 0x0f) | 0x40 // version 4
  bytes[8] = (b8 & 0x3f) | 0x80 // variant 10
  const hex: string[] = []
  for (const b of bytes) hex.push(b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}
