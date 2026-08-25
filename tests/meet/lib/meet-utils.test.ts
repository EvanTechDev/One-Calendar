import { describe, it, expect } from 'vitest'
import {
  decodePassphrase,
  encodePassphrase,
  generatePassphrase,
  isLowPowerDevice,
  randomString,
  resolveRegionalUrl,
} from '@/lib/meet-utils'

describe('randomString', () => {
  it('honours the requested length', () => {
    expect(randomString(1)).toHaveLength(1)
    expect(randomString(48)).toHaveLength(48)
    expect(randomString(0)).toHaveLength(0)
  })

  it('only emits lowercase alphanumerics', () => {
    expect(randomString(200)).toMatch(/^[a-z0-9]+$/)
  })
})

describe('passphrases', () => {
  it('round-trips through the URL hash encoding', () => {
    const passphrase = generatePassphrase()
    expect(passphrase).toHaveLength(64)
    expect(decodePassphrase(encodePassphrase(passphrase))).toBe(passphrase)
  })

  it('round-trips values needing percent-encoding', () => {
    const raw = 'a b/c?d#e&f=g'
    expect(decodePassphrase(encodePassphrase(raw))).toBe(raw)
  })

  it('throws on a malformed escape sequence', () => {
    // BUG (audit CORRECT-01, fixed in plan 020): a damaged invite link
    // reaches decodeURIComponent during render and throws. Pinned here so
    // the fix has a failing-then-passing anchor.
    expect(() => decodePassphrase('%zz')).toThrow(URIError)
  })
})

describe('resolveRegionalUrl', () => {
  it('pins a region on a production cloud host', () => {
    expect(resolveRegionalUrl('wss://myproject.livekit.cloud', 'eu')).toContain(
      'myproject.eu.production.livekit.cloud',
    )
  })

  it('keeps staging in the hostname when pinning a region', () => {
    const url = resolveRegionalUrl(
      'wss://myproject.staging.livekit.cloud',
      'eu',
    )
    expect(url).toContain('myproject.eu.staging.livekit.cloud')
    expect(url).not.toContain('production')
  })

  it('leaves self-hosted hosts untouched', () => {
    const url = resolveRegionalUrl('wss://livekit.example.com', 'eu')
    expect(url).toContain('livekit.example.com')
    expect(url).not.toContain('eu.')
  })

  it('is a no-op without a region', () => {
    expect(resolveRegionalUrl('wss://myproject.livekit.cloud', null)).toContain(
      'myproject.livekit.cloud',
    )
    expect(
      resolveRegionalUrl('wss://myproject.livekit.cloud', undefined),
    ).toContain('myproject.livekit.cloud')
  })

  it('preserves the websocket scheme', () => {
    expect(resolveRegionalUrl('wss://myproject.livekit.cloud', 'us')).toMatch(
      /^wss:/,
    )
  })
})

describe('isLowPowerDevice', () => {
  it('treats fewer than six cores as low power', () => {
    const original = navigator.hardwareConcurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      value: 4,
      configurable: true,
    })
    expect(isLowPowerDevice()).toBe(true)
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      value: 8,
      configurable: true,
    })
    expect(isLowPowerDevice()).toBe(false)
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      value: original,
      configurable: true,
    })
  })
})
