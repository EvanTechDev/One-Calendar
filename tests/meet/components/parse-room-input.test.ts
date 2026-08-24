import { describe, it, expect } from 'vitest'
import { parseRoomInput } from '@/components/home-actions'

describe('parseRoomInput', () => {
  it('accepts a bare room code', () => {
    expect(parseRoomInput('ab3k-x9q2')).toBe('ab3k-x9q2')
  })

  it('trims surrounding whitespace', () => {
    expect(parseRoomInput('  ab3k-x9q2  ')).toBe('ab3k-x9q2')
  })

  it('extracts the code from a root-path room URL', () => {
    expect(parseRoomInput('https://meet.example.com/ab3k-x9q2')).toBe(
      'ab3k-x9q2',
    )
  })

  it('still accepts a legacy /rooms/ URL', () => {
    expect(parseRoomInput('https://meet.example.com/rooms/ab3k-x9q2')).toBe(
      'ab3k-x9q2',
    )
  })

  it('rejects a code that is not the xxxx-xxxx shape', () => {
    expect(parseRoomInput('abc')).toBeNull()
    expect(parseRoomInput('ab3k_x9q2')).toBeNull()
    expect(parseRoomInput('AB3K-X9Q2')).toBeNull()
  })

  it('extracts the code from a URL carrying query params', () => {
    expect(parseRoomInput('https://meet.example.com/ab3k-x9q2?hq=true')).toBe(
      'ab3k-x9q2',
    )
  })

  it('extracts the code from a URL carrying an E2EE hash', () => {
    // The passphrase itself is carried by the navigation step, not this
    // parser (see invitePartsFrom in home-actions).
    expect(parseRoomInput('https://meet.example.com/ab3k-x9q2#secret')).toBe(
      'ab3k-x9q2',
    )
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
