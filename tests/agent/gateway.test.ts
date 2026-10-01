import { describe, it, expect } from 'vitest'
import { summarizeProviderError } from '@zntr/agent'

/** Shape of the AI SDK's APICallError, which is what actually gets thrown. */
function apiCallError(statusCode: number, responseBody: string) {
  return Object.assign(new Error('Provider returned an error'), {
    name: 'AI_APICallError',
    statusCode,
    responseBody,
    isRetryable: false,
    requestBodyValues: { messages: [{ role: 'user', content: 'secret' }] },
  })
}

describe('summarizeProviderError', () => {
  it('classifies a 403 from the gateway as blocked', () => {
    // Groq answers a CDN/WAF refusal with 403 and this exact body. It is not
    // a bad request, so it must never read as a parse failure.
    const failure = summarizeProviderError(
      apiCallError(
        403,
        '{"error":{"message":"Access denied. Please check your network settings."}}',
      ),
    )
    expect(failure.status).toBe(403)
    expect(failure.kind).toBe('blocked')
    expect(failure.detail).toBe(
      '{"error":{"message":"Access denied. Please check your network settings."}}',
    )
  })

  it('classifies 401 as auth and 429 as a provider rate limit', () => {
    expect(summarizeProviderError(apiCallError(401, 'nope')).kind).toBe('auth')
    expect(summarizeProviderError(apiCallError(429, 'slow down')).kind).toBe(
      'rate_limit',
    )
  })

  it('classifies a rejected schema as bad_request', () => {
    expect(summarizeProviderError(apiCallError(400, 'bad schema')).kind).toBe(
      'bad_request',
    )
    expect(summarizeProviderError(apiCallError(422, 'bad schema')).kind).toBe(
      'bad_request',
    )
  })

  it('falls back to the error message and upstream for anything else', () => {
    expect(summarizeProviderError(apiCallError(500, 'boom'))).toEqual({
      status: 500,
      kind: 'upstream',
      detail: 'boom',
    })
    expect(summarizeProviderError(new Error('socket hang up'))).toEqual({
      status: null,
      kind: 'upstream',
      detail: 'socket hang up',
    })
  })

  it('accepts a bare status field', () => {
    expect(summarizeProviderError({ status: 403 })).toEqual({
      status: 403,
      kind: 'blocked',
      detail: 'unknown error',
    })
  })

  it('handles a thrown string and null', () => {
    expect(summarizeProviderError('timed out')).toEqual({
      status: null,
      kind: 'upstream',
      detail: 'timed out',
    })
    expect(summarizeProviderError(null)).toEqual({
      status: null,
      kind: 'upstream',
      detail: 'null',
    })
  })

  it('collapses whitespace and truncates a long body', () => {
    const failure = summarizeProviderError(
      apiCallError(500, `  a\n\nb${'c'.repeat(400)}  `),
    )
    expect(failure.detail).toHaveLength(200)
    expect(failure.detail.startsWith('a bc')).toBe(true)
  })
})
