// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { authEmailBrand, type EmailBrand } from '@zntr/auth/email-brand'

/**
 * Email branding.
 *
 * The template hard-coded "Zentra Calendar" in six places plus the tagline
 * "A privacy-first calendar that keeps your data yours." That was fine while the
 * calendar was the only sign-up surface. Meet is gaining one, and a user
 * registering at meet receiving mail signed by a different product is a defect
 * (ADR 0022).
 */
const CALENDAR: EmailBrand = {
  appName: 'Zentra Calendar',
  tagline: 'A privacy-first calendar that keeps your data yours.',
  baseUrl: 'https://precal.xyehr.cn',
  sender: 'Zentra Calendar <no-reply@xyehr.cn>',
}

describe('authEmailBrand', () => {
  it('reads the brand from the environment', () => {
    const brand = authEmailBrand({
      appName: 'Zentra Meet',
      tagline: 'Meetings that respect your privacy.',
      baseUrl: 'https://meettest.xyehr.cn',
    })
    expect(brand.appName).toBe('Zentra Meet')
    expect(brand.baseUrl).toBe('https://meettest.xyehr.cn')
  })

  it('derives a sender from the app name when none is given', () => {
    // Every app would otherwise have to repeat the address, and one of them would
    // eventually disagree with its own display name.
    const brand = authEmailBrand({
      appName: 'Zentra Meet',
      tagline: 't',
      baseUrl: 'https://m.example.com',
    })
    expect(brand.sender).toContain('Zentra Meet')
    expect(brand.sender).toMatch(/<[^>]+@[^>]+>/)
  })

  it('keeps an explicit sender', () => {
    const brand = authEmailBrand({ ...CALENDAR })
    expect(brand.sender).toBe('Zentra Calendar <no-reply@xyehr.cn>')
  })

  it('strips a trailing slash from baseUrl', () => {
    // The template interpolates `${baseUrl}/icon.svg`, so a trailing slash
    // produces a double slash — which some mail clients refuse to load.
    const brand = authEmailBrand({
      appName: 'A',
      tagline: 't',
      baseUrl: 'https://a.example.com/',
    })
    expect(brand.baseUrl).toBe('https://a.example.com')
  })

  it('falls back to localhost for a missing baseUrl, rather than emitting a relative URL', () => {
    // A relative image src in an email resolves against the mail client, not the
    // app, so it silently shows nothing.
    const brand = authEmailBrand({ appName: 'A', tagline: 't' })
    expect(brand.baseUrl).toMatch(/^https?:\/\//)
  })

  it('exposes a logo url under the app origin', () => {
    const brand = authEmailBrand({ ...CALENDAR })
    expect(brand.logoUrl).toBe('https://precal.xyehr.cn/icon.svg')
  })

  it('accepts an explicit logo url, for an app whose icon is elsewhere', () => {
    const brand = authEmailBrand({
      ...CALENDAR,
      logoUrl: 'https://cdn.example.com/meet.png',
    })
    expect(brand.logoUrl).toBe('https://cdn.example.com/meet.png')
  })

  it('rejects an empty app name instead of sending unsigned mail', () => {
    // A blank brand renders an email with no sender identity, which is both a
    // phishing signal to the recipient and a deliverability problem.
    expect(() => authEmailBrand({ appName: '   ', tagline: 't' })).toThrow(
      /appName/,
    )
  })
})
