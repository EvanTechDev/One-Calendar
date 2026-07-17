import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('auth configuration', () => {
  let authModule: any

  beforeEach(async () => {
    vi.resetModules()
    authModule = await import('@/lib/auth')
  })

  it('exports auth instance', () => {
    expect(authModule.auth).toBeDefined()
  })

  it('has email and password enabled', () => {
    expect(authModule.auth.options.emailAndPassword.enabled).toBe(true)
  })

  it('requires email verification', () => {
    expect(
      authModule.auth.options.emailAndPassword.requireEmailVerification,
    ).toBe(true)
  })

  it('has password hashing configured', () => {
    expect(authModule.auth.options.emailAndPassword.password.hash).toBeDefined()
    expect(
      authModule.auth.options.emailAndPassword.password.verify,
    ).toBeDefined()
  })

  it('has email verification configured', () => {
    expect(
      authModule.auth.options.emailVerification.sendVerificationEmail,
    ).toBeDefined()
    expect(
      authModule.auth.options.emailVerification.sendChangeEmailVerification,
    ).toBeDefined()
  })

  it('has plugins configured', () => {
    expect(authModule.auth.options.plugins).toBeDefined()
    expect(Array.isArray(authModule.auth.options.plugins)).toBe(true)
  })

  it('has two-factor authentication plugin', () => {
    const pluginNames = authModule.auth.options.plugins.map((p: any) => p.id)
    expect(pluginNames).toContain('two-factor')
  })

  it('has sentinel plugin for security', () => {
    const pluginNames = authModule.auth.options.plugins.map((p: any) => p.id)
    expect(pluginNames).toContain('sentinel')
  })

  it('has email OTP plugin', () => {
    const pluginNames = authModule.auth.options.plugins.map((p: any) => p.id)
    expect(pluginNames).toContain('email-otp')
  })

  it('has trusted origins configured', () => {
    expect(authModule.auth.options.trustedOrigins).toBeDefined()
    expect(Array.isArray(authModule.auth.options.trustedOrigins)).toBe(true)
  })

  it('uses drizzle adapter', () => {
    expect(authModule.auth.options.database).toBeDefined()
  })
})
