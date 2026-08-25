import { describe, expect, it } from 'vitest'
import {
  MATCH_SNIPPET_LENGTH,
  MIN_SEARCH_LENGTH,
  buildSnippet,
  describeMatches,
  shouldSearch,
} from '../../../apps/meet/lib/search-matches'
import type { MeetingMatch } from '../../../apps/meet/lib/search-matches'

/**
 * The reported problem: search works but its results are unreadable — a name or
 * chat-phrase query returned rows showing only a room code and a date. These
 * are the rules that turn a match into a line the user can read.
 */

describe('buildSnippet', () => {
  it('splits the text around the match', () => {
    const snippet = buildSnippet('we should discuss the budget today', 'budget')

    expect(snippet.match).toBe('budget')
    expect(snippet.before).toContain('discuss the ')
    expect(snippet.after).toBe(' today')
  })

  it('keeps the source casing, not the query casing', () => {
    const snippet = buildSnippet('Ask Priya about it', 'priya')

    // The point is to show what was written; echoing the query back would
    // misquote the message.
    expect(snippet.match).toBe('Priya')
  })

  it('marks the window with an ellipsis when it starts mid-text', () => {
    const long = `${'filler words here and there '.repeat(6)}budget talk`
    const snippet = buildSnippet(long, 'budget')

    expect(snippet.before.startsWith('…')).toBe(true)
    expect(snippet.match).toBe('budget')
  })

  it('does not lead with an ellipsis when the match is near the start', () => {
    const snippet = buildSnippet('budget is the topic', 'budget')

    expect(snippet.before).toBe('')
  })

  it('stays within the length budget', () => {
    const long = `${'a '.repeat(200)}needle${' b'.repeat(200)}`
    const snippet = buildSnippet(long, 'needle')
    const length =
      snippet.before.length + snippet.match.length + snippet.after.length

    // A row has to stay one line on a phone.
    expect(length).toBeLessThanOrEqual(MATCH_SNIPPET_LENGTH + 2)
  })

  it('collapses newlines and runs of spaces so a row stays one line', () => {
    const snippet = buildSnippet('hello\n\n  there    budget', 'budget')

    expect(snippet.before).not.toMatch(/\n/)
    expect(snippet.before).not.toMatch(/ {2}/)
  })

  it('still shows the text when the term is not locatable', () => {
    const snippet = buildSnippet('some retained line', 'nothing here')

    // A row that cannot be explained should show its text, not a blank.
    expect(snippet.match).toBe('')
    expect(snippet.before).toBe('some retained line')
  })

  it('truncates an unmatched long text rather than emitting all of it', () => {
    const snippet = buildSnippet('x'.repeat(500), 'absent')

    expect(snippet.before.length).toBeLessThanOrEqual(MATCH_SNIPPET_LENGTH)
    expect(snippet.before.endsWith('…')).toBe(true)
  })

  it('treats an empty term as unlocatable instead of matching at index 0', () => {
    const snippet = buildSnippet('anything', '')

    expect(snippet.match).toBe('')
  })
})

describe('shouldSearch', () => {
  it('waits for enough characters to be worth a request', () => {
    expect(shouldSearch('')).toBe(false)
    expect(shouldSearch('a')).toBe(false)
    expect(shouldSearch('ab')).toBe(true)
  })

  it('ignores surrounding whitespace', () => {
    expect(shouldSearch('   ')).toBe(false)
    expect(shouldSearch('  ab  ')).toBe(true)
  })

  it('agrees with the advertised minimum', () => {
    expect(shouldSearch('x'.repeat(MIN_SEARCH_LENGTH))).toBe(true)
    expect(shouldSearch('x'.repeat(MIN_SEARCH_LENGTH - 1))).toBe(false)
  })
})

describe('describeMatches', () => {
  it('describes an attendee match by name', () => {
    const described = describeMatches(
      [{ kind: 'attendee', name: 'Priya R' }],
      'priya',
    )

    expect(described).toHaveLength(1)
    expect(described[0]!.kind).toBe('attendee')
    expect(described[0]!.label).toBe('Priya R')
    // The name is the match, so the highlight has to land inside it.
    expect(described[0]!.snippet?.match).toBe('Priya')
  })

  it('describes a chat match by sender and line', () => {
    const described = describeMatches(
      [{ kind: 'chat', sender: 'Sam', message: 'the budget is approved' }],
      'budget',
    )

    expect(described[0]!.kind).toBe('chat')
    expect(described[0]!.label).toBe('Sam')
    expect(described[0]!.snippet?.match).toBe('budget')
  })

  it('says nothing for a room-code match', () => {
    // The code is already the row's heading; repeating it under itself is noise.
    expect(describeMatches([{ kind: 'code' }], 'ab3k')).toEqual([])
  })

  it('describes nothing for no matches', () => {
    expect(describeMatches([], 'anything')).toEqual([])
  })

  it('keeps attendee and chat reasons for one meeting', () => {
    const matches: MeetingMatch[] = [
      { kind: 'attendee', name: 'Budget Bot' },
      { kind: 'chat', sender: 'Sam', message: 'budget please' },
    ]

    expect(describeMatches(matches, 'budget').map((m) => m.kind)).toEqual([
      'attendee',
      'chat',
    ])
  })
})
