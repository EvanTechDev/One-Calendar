import { describe, expect, it } from 'vitest'
import {
  CHAT_GROUP_GAP_MS,
  groupChatMessages,
} from '../../../apps/meet/lib/chat-grouping'
import type { ChatMessageLike } from '../../../apps/meet/lib/chat-grouping'

/**
 * The reported problem: the other party's bubble is too big for a 320px panel.
 * Most of that weight was the sender name repeating above every single message,
 * so grouping a run is the fix being proved here.
 */

let clock = Date.UTC(2026, 7, 25, 9, 0, 0)

function message(
  text: string,
  from: { identity: string; name?: string; isLocal?: boolean },
  advanceMs = 1000,
): ChatMessageLike {
  clock += advanceMs
  return {
    id: `m-${clock}-${text}`,
    message: text,
    timestamp: clock,
    from,
  }
}

const alice = { identity: 'alice', name: 'Alice' }
const bob = { identity: 'bob', name: 'Bob' }
const me = { identity: 'me', name: 'Me', isLocal: true }

describe('groupChatMessages', () => {
  it('has no groups for no messages', () => {
    expect(groupChatMessages([])).toEqual([])
  })

  it('folds a sender consecutive run into one group', () => {
    const groups = groupChatMessages([
      message('hi', alice),
      message('you there?', alice),
      message('ok', alice),
    ])

    // One header for three messages: three name lines became one.
    expect(groups).toHaveLength(1)
    expect(groups[0]!.messages.map((m) => m.message)).toEqual([
      'hi',
      'you there?',
      'ok',
    ])
  })

  it('starts a new group when the sender changes', () => {
    const groups = groupChatMessages([
      message('hi', alice),
      message('hello', bob),
      message('back to me', alice),
    ])

    expect(groups.map((group) => group.senderName)).toEqual([
      'Alice',
      'Bob',
      'Alice',
    ])
  })

  it('labels the local participant "You" and marks it local', () => {
    const groups = groupChatMessages([message('mine', me)])

    expect(groups[0]!.senderName).toBe('You')
    expect(groups[0]!.isLocal).toBe(true)
  })

  it('never folds a local and a remote sender sharing a name', () => {
    const groups = groupChatMessages([
      message('theirs', { identity: 'other', name: 'Sam' }),
      message('mine', { identity: 'me', name: 'Sam', isLocal: true }),
    ])

    // Same display name, opposite sides — folding them would attribute a
    // remote message to the viewer.
    expect(groups).toHaveLength(2)
    expect(groups[0]!.isLocal).toBe(false)
    expect(groups[1]!.isLocal).toBe(true)
  })

  it('breaks a run after a long silence', () => {
    const groups = groupChatMessages([
      message('before lunch', alice),
      message('back', alice, CHAT_GROUP_GAP_MS + 1),
    ])

    // A reply after a gap gets its own header, which is the only reason the
    // header carries a time at all.
    expect(groups).toHaveLength(2)
  })

  it('keeps a run together right up to the gap', () => {
    const groups = groupChatMessages([
      message('one', alice),
      message('two', alice, CHAT_GROUP_GAP_MS),
    ])

    expect(groups).toHaveLength(1)
  })

  it('measures the gap from the previous message, not the group start', () => {
    const groups = groupChatMessages([
      message('one', alice),
      message('two', alice, CHAT_GROUP_GAP_MS - 1000),
      message('three', alice, CHAT_GROUP_GAP_MS - 1000),
    ])

    // A steady trickle stays one run even though the last message is well past
    // the first — comparing against the group start would split it.
    expect(groups).toHaveLength(1)
    expect(groups[0]!.messages).toHaveLength(3)
  })

  it('splits a run when a sender clock runs backwards past the gap', () => {
    const groups = groupChatMessages([
      message('later', alice),
      message('earlier', alice, -(CHAT_GROUP_GAP_MS + 1)),
    ])

    // Timestamps come off the sender's clock, so a skewed peer can deliver a
    // message stamped in the past; a forward-only comparison would have
    // grouped these and shown a header time far from the message.
    expect(groups).toHaveLength(2)
  })

  it('carries the run start time on the group header', () => {
    const first = message('one', alice)
    const groups = groupChatMessages([first, message('two', alice)])

    expect(groups[0]!.timestamp).toBe(first.timestamp)
  })

  it('keys a group by its first message so it is stable', () => {
    const first = message('one', alice)
    const groups = groupChatMessages([first, message('two', alice)])

    expect(groups[0]!.key).toBe(first.id)
  })

  it('falls back to the identity when a participant has no name', () => {
    const groups = groupChatMessages([message('anon', { identity: 'gst_12' })])

    expect(groups[0]!.senderName).toBe('gst_12')
  })

  it('names an unidentifiable sender rather than showing nothing', () => {
    const groups = groupChatMessages([
      { id: 'x', message: 'ghost', timestamp: clock },
    ])

    expect(groups[0]!.senderName).toBe('Participant')
  })
})
