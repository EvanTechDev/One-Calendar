import { describe, it, expect } from 'vitest'
import { parseRoomInput } from '@/components/home-actions'

describe('parseRoomInput', () => {
  it('accepts a bare room code', () => {
    expect(parseRoomInput('ab3k-x9q2')).toBe('ab3k-x9q2')
  })

  it('trims surrounding whitespace', () => {
    expect(parseRoomInput('  ab3k-x9q2  ')).toBe('ab3k-x9q2')
  })

  it('extracts the code from a full room URL', () => {
    expect(parseRoomInput('https://meet.example.com/rooms/ab3k-x9q2')).toBe(
      'ab3k-x9q2',
    )
  })

  it('extracts the code from a URL carrying query params', () => {
    expect(
      parseRoomInput('https://meet.example.com/rooms/ab3k-x9q2?hq=true'),
    ).toBe('ab3k-x9q2')
  })

  it('extracts the code from a URL carrying an E2EE hash', () => {
    // Note: the passphrase in the hash is dropped by the caller today
    // (audit CORRECT-02, fixed in plan 019). This asserts the parse step
    // only; hash preservation is the navigation step's job.
    expect(
      parseRoomInput('https://meet.example.com/rooms/ab3k-x9q2#secret'),
    ).toBe('ab3k-x9q2')
  })

  it('rejects empty input', () => {
    expect(parseRoomInput('')).toBeNull()
    expect(parseRoomInput('   ')).toBeNull()
  })

  it('rejects a code containing spaces', () => {
    expect(parseRoomInput('ab3k x9q2')).toBeNull()
  })

  it('rejects a URL that is not a room link', () => {
    expect(parseRoomInput('https://meet.example.com/dashboard')).toBeNull()
  })
})
