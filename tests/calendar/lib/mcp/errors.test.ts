import { describe, expect, it } from 'vitest'
import {
  CLIENT_ERROR_TYPES,
  clientErrorMessage,
  InvalidEventQueryError,
  isClientError,
  ParticipantError,
} from '@/lib/mcp/errors'

/**
 * The decision every MCP tool now shares: is this failure the caller's fault,
 * or ours?
 *
 * This list replaced twenty-nine `instanceof` tests that each named one class.
 * The bug that motivated it: `lib/mcp/event-tools.ts` throws both classes, so
 * `create_event`, which only checked `ParticipantError`, answered an ordinary
 * rejected query with "Internal server error".
 */
describe('mcp client errors', () => {
  it('recognises every class on the list, whichever one a tool remembered to check', () => {
    for (const type of CLIENT_ERROR_TYPES) {
      expect(isClientError(new type('rejected'))).toBe(true)
    }
  })

  it('includes both error classes that lib/mcp throws', () => {
    expect(CLIENT_ERROR_TYPES).toContain(InvalidEventQueryError)
    expect(CLIENT_ERROR_TYPES).toContain(ParticipantError)
  })

  it('does not mistake a bug for a rejected request', () => {
    expect(isClientError(new TypeError('x is not a function'))).toBe(false)
    expect(isClientError(new Error('connection terminated'))).toBe(false)
  })

  it('does not mistake a thrown non-error for a rejected request', () => {
    expect(isClientError('Invalid range')).toBe(false)
    expect(isClientError(undefined)).toBe(false)
    expect(isClientError(null)).toBe(false)
    expect(isClientError({ message: 'nope' })).toBe(false)
  })

  it('keeps the message of a client error, including its status code', () => {
    expect(clientErrorMessage(new InvalidEventQueryError('bad range'))).toBe(
      'bad range',
    )
    expect(
      clientErrorMessage(new ParticipantError('too many recipients', 429)),
    ).toBe('too many recipients')
  })

  it('has a fallback message for a non-Error that somehow got past the check', () => {
    // Unreachable through respondToolError, which gates on isClientError
    // first. Pinned so the fallback stays a fallback rather than becoming the
    // reason a bug reports itself as an invalid request.
    expect(clientErrorMessage('boom')).toBe('Invalid request')
  })

  it('recognises a subclass of a client error as a client error', () => {
    class QuotaError extends ParticipantError {}
    expect(isClientError(new QuotaError('reminder quota reached'))).toBe(true)
  })
})
