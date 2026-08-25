import { describe, it, expect } from 'vitest'
import {
  REACTIONS,
  decodeReaction,
  encodeReaction,
  isReaction,
} from '@/lib/room-signals'

describe('reaction wire format', () => {
  it('round-trips a reaction', () => {
    const message = { emoji: REACTIONS[0], from: 'Ada' }
    expect(decodeReaction(encodeReaction(message))).toEqual(message)
  })

  it('survives a name with non-ASCII characters', () => {
    const message = { emoji: REACTIONS[2], from: '张三' }
    expect(decodeReaction(encodeReaction(message))).toEqual(message)
  })

  it('rejects an unknown emoji', () => {
    // Anything a peer sends is untrusted: an arbitrary string must not end up
    // rendered as a reaction.
    const payload = new TextEncoder().encode(
      JSON.stringify({ emoji: '💣', from: 'Someone' }),
    )
    expect(decodeReaction(payload)).toBeNull()
  })

  it('rejects a payload with no sender', () => {
    const payload = new TextEncoder().encode(
      JSON.stringify({ emoji: REACTIONS[0] }),
    )
    expect(decodeReaction(payload)).toBeNull()
  })

  it('rejects malformed JSON', () => {
    expect(decodeReaction(new TextEncoder().encode('{not json'))).toBeNull()
  })

  it('rejects a JSON primitive', () => {
    expect(decodeReaction(new TextEncoder().encode('"hello"'))).toBeNull()
  })

  it('recognises exactly the offered reactions', () => {
    for (const emoji of REACTIONS) {
      expect(isReaction(emoji)).toBe(true)
    }
    expect(isReaction('🙃')).toBe(false)
    expect(isReaction('')).toBe(false)
  })
})
