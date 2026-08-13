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