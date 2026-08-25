import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { ChatPanel } from '@/components/room/chat-panel'
import type { RoomChat } from '@/hooks/use-room-chat'

/**
 * The reported problem: the other party's bubble is too big for a 320px panel.
 *
 * Two causes are asserted here. The name line repeated above every message, and
 * the message container was a stretched flex child — so `max-w-[85%]` acted as
 * an exact width and a one-word reply rendered a 272px slab.
 */

vi.mock('@livekit/components-react', () => ({}))

type Message = Parameters<typeof makeChat>[0][number]

function makeChat(
  messages: {
    id: string
    message: string
    timestamp: number
    from?: { identity?: string; name?: string; isLocal?: boolean }
  }[],
): RoomChat {
  return {
    // The panel only reads and renders these; the shape matches
    // ReceivedChatMessage closely enough for a layout assertion.
    messages: messages as unknown as RoomChat['messages'],
    send: vi.fn(async () => true),
    unread: 0,
    markRead: vi.fn(),
  }
}

const at = (minute: number) => Date.UTC(2026, 7, 25, 9, minute, 0)

function remote(id: string, text: string, minute: number): Message {
  return {
    id,
    message: text,
    timestamp: at(minute),
    from: { identity: 'alice', name: 'Alice' },
  }
}

function local(id: string, text: string, minute: number): Message {
  return {
    id,
    message: text,
    timestamp: at(minute),
    from: { identity: 'me', name: 'Me', isLocal: true },
  }
}

function renderPanel(messages: Message[]) {
  const { container } = render(
    <ChatPanel onClose={vi.fn()} chat={makeChat(messages)} retainMessages />,
  )
  return container
}

/** The element actually carrying a message's text. */
function bubbleFor(container: HTMLElement, text: string): HTMLElement {
  // The innermost div holding exactly this text: a linkified URL puts an <a>
  // inside, so "no children" is not a usable test for the leaf.
  const found = Array.from(container.querySelectorAll<HTMLElement>('div'))
    .filter((node) => node.textContent === text)
    .at(-1)
  expect(found, text).toBeDefined()
  return found!
}

/** The alignment wrapper for one sender's run. */
function groupFor(container: HTMLElement, text: string): HTMLElement {
  const bubble = bubbleFor(container, text)
  // bubble → per-run column → the group block that owns the alignment.
  return bubble.parentElement!.parentElement!
}

describe('ChatPanel density', () => {
  beforeEach(() => {
    cleanup()
    // jsdom implements no scrolling at all, and the panel scrolls itself to the
    // newest message on mount.
    Element.prototype.scrollTo = vi.fn()
  })

  it('names a sender once per run, not once per message', () => {
    renderPanel([
      remote('a', 'hi', 0),
      remote('b', 'you there?', 1),
      remote('c', 'ok', 2),
    ])

    // Three name lines for three one-word messages was the bulk of the weight.
    expect(screen.getAllByText('Alice')).toHaveLength(1)
  })

  it('names the sender again when the other party replies between', () => {
    renderPanel([
      remote('a', 'hi', 0),
      local('b', 'hello', 1),
      remote('c', 'still there', 2),
    ])

    expect(screen.getAllByText('Alice')).toHaveLength(2)
    expect(screen.getAllByText('You')).toHaveLength(1)
  })

  it('never lets a message box stretch to the full panel width', () => {
    const container = renderPanel([remote('a', 'ok', 0), local('b', 'yes', 1)])

    // `items-stretch` (the flex default) is what made `max-w-[85%]` behave as
    // an exact width. An explicit alignment is what makes the box hug its text.
    expect(groupFor(container, 'ok').className).toContain('items-start')
    expect(groupFor(container, 'yes').className).toContain('items-end')

    // And the cap itself leaves room, rather than claiming 85% of a 320px
    // panel for a two-letter reply.
    expect(bubbleFor(container, 'ok').className).toContain(
      'max-w-[calc(100%-1.5rem)]',
    )
  })

  it('drops the bubble for a remote message and keeps it for the local one', () => {
    const container = renderPanel([
      remote('a', 'theirs', 0),
      local('b', 'mine', 1),
    ])

    // Google Meet uses a name + text block for the remote side (ADR 0018 makes
    // Google the baseline); the local bubble is then the only thing marking
    // "mine", so it stays.
    const theirs = bubbleFor(container, 'theirs')
    expect(theirs.className).not.toMatch(/bg-muted|bg-primary/)
    expect(theirs.className).not.toMatch(/rounded-(lg|2xl)/)

    const mine = bubbleFor(container, 'mine')
    expect(mine.className).toContain('bg-primary')
    expect(mine.className).toContain('rounded-2xl')
  })

  it('gives a long word an anywhere break so a URL cannot widen the panel', () => {
    const container = renderPanel([
      remote('a', 'https://example.com/a-very-long-path-that-never-wraps', 0),
    ])
    const bubble = bubbleFor(
      container,
      'https://example.com/a-very-long-path-that-never-wraps',
    )

    // `break-words` alone does not break inside a single long token.
    expect(bubble.className).toContain('[overflow-wrap:anywhere]')
  })

  it('shows one time per run, on the sender line', () => {
    const container = renderPanel([
      remote('a', 'hi', 0),
      remote('b', 'and again', 1),
    ])

    // A time per message would undo the line the grouping just saved.
    const times = container.querySelectorAll('time')
    expect(times).toHaveLength(1)
    expect(times[0]!.getAttribute('datetime')).toBe(
      new Date(at(0)).toISOString(),
    )
  })

  it('still says when there is nothing to show', () => {
    renderPanel([])
    expect(screen.getByText('No messages yet')).toBeInTheDocument()
  })

  it('declares retention honestly in both modes', () => {
    // ADR 0020: an encrypted room never retains chat, and the panel says so.
    const { unmount } = render(
      <ChatPanel onClose={vi.fn()} chat={makeChat([])} retainMessages />,
    )
    expect(
      screen.getByText(/Messages are saved to this meeting/),
    ).toBeInTheDocument()
    unmount()

    render(
      <ChatPanel
        onClose={vi.fn()}
        chat={makeChat([])}
        retainMessages={false}
      />,
    )
    expect(
      screen.getByText(/Encrypted meeting — messages are not saved/),
    ).toBeInTheDocument()
  })
})
