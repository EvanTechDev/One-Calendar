/**
 * Zentra Meet has no sign-in surface of its own, so it links to the calendar's
 * and expects the user back. That return URL is attacker-controllable input on
 * a page that is about to establish a session, which makes the allowlist the
 * entire security property here — not a nicety.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DEFAULT_SIGNED_IN_PATH, resolveReturnTo } from '@/lib/auth/return-to'

const MEET = 'https://meet.zntr.app'

beforeEach(() => {
  process.env.NEXT_PUBLIC_MEET_ORIGIN = MEET
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_MEET_ORIGIN
})

describe('resolveReturnTo', () => {
  it('defaults when nothing was requested', () => {
    expect(resolveReturnTo(undefined)).toBe(DEFAULT_SIGNED_IN_PATH)
    expect(resolveReturnTo(null)).toBe(DEFAULT_SIGNED_IN_PATH)
    expect(resolveReturnTo('')).toBe(DEFAULT_SIGNED_IN_PATH)
  })

  it('allows app-relative paths', () => {
    expect(resolveReturnTo('/app/settings')).toBe('/app/settings')
  })

  it('allows the configured meet origin', () => {
    expect(resolveReturnTo(`${MEET}/`)).toBe(`${MEET}/`)
    expect(resolveReturnTo(`${MEET}/abcd-efgh`)).toBe(`${MEET}/abcd-efgh`)
  })

  it('refuses a foreign origin', () => {
    expect(resolveReturnTo('https://evil.example/steal')).toBe(
      DEFAULT_SIGNED_IN_PATH,
    )
  })

  it('refuses a lookalike host that merely contains the allowed origin', () => {
    expect(resolveReturnTo('https://meet.zntr.app.evil.example/')).toBe(
      DEFAULT_SIGNED_IN_PATH,
    )
    expect(
      resolveReturnTo('https://evil.example/?x=https://meet.zntr.app'),
    ).toBe(DEFAULT_SIGNED_IN_PATH)
  })

  it('refuses protocol-relative URLs, which browsers treat as absolute', () => {
    expect(resolveReturnTo('//evil.example/')).toBe(DEFAULT_SIGNED_IN_PATH)
    expect(resolveReturnTo('/\\evil.example/')).toBe(DEFAULT_SIGNED_IN_PATH)
  })

  it('refuses non-http schemes', () => {
    expect(resolveReturnTo('javascript:alert(1)')).toBe(DEFAULT_SIGNED_IN_PATH)
    expect(resolveReturnTo('data:text/html,<script>1</script>')).toBe(
      DEFAULT_SIGNED_IN_PATH,
    )
  })

  it('refuses everything absolute when no meet origin is configured', () => {
    delete process.env.NEXT_PUBLIC_MEET_ORIGIN
    expect(resolveReturnTo(`${MEET}/`)).toBe(DEFAULT_SIGNED_IN_PATH)
    // A relative path is same-origin by construction, so it still stands.
    expect(resolveReturnTo('/app')).toBe('/app')
  })

  it('refuses a different port on the allowed host', () => {
    expect(resolveReturnTo('https://meet.zntr.app:8443/')).toBe(
      DEFAULT_SIGNED_IN_PATH,
    )
  })
})
