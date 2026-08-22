import { describe, it, expect, afterEach, vi } from 'vitest'

describe('lib/turnstile', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('calls siteverify and maps success to { success: true }', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { verifyTurnstile } = await import('@/lib/turnstile')
    const result = await verifyTurnstile('test-token', 'login')

    expect(result).toEqual({ success: true, errorCodes: undefined })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('maps Cloudflare error codes into errorCodes', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          'error-codes': ['timeout-or-duplicate'],
        }),
      }),
    )

    const { verifyTurnstile } = await import('@/lib/turnstile')
    const result = await verifyTurnstile('test-token', 'login')

    expect(result).toEqual({
      success: false,
      errorCodes: ['timeout-or-duplicate'],
    })
  })

  it('throws when TURNSTILE_SECRET_KEY is unset', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')

    const { verifyTurnstile } = await import('@/lib/turnstile')
    await expect(verifyTurnstile('test-token', 'login')).rejects.toThrow(
      'TURNSTILE_SECRET_KEY is not configured',
    )
  })
})

describe('isTurnstileConfigured', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is true when a secret is set', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    const { isTurnstileConfigured } = await import('@/lib/turnstile')
    expect(isTurnstileConfigured()).toBe(true)
  })

  it('is false when the secret is empty', async () => {
    // The case that locked sign-in: the client omits the widget, so the server
    // must not demand a token.
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    const { isTurnstileConfigured } = await import('@/lib/turnstile')
    expect(isTurnstileConfigured()).toBe(false)
  })

  it('is false when the secret is whitespace only', async () => {
    // An env var set to a blank string in a dashboard is indistinguishable from
    // unset as far as intent goes, and would otherwise be treated as enabled.
    vi.stubEnv('TURNSTILE_SECRET_KEY', '   ')
    const { isTurnstileConfigured } = await import('@/lib/turnstile')
    expect(isTurnstileConfigured()).toBe(false)
  })
})
