import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ControlBar } from '@/components/room/control-bar'
import type { RoomEventContext } from '@/lib/event-context'

// The control bar only reads publish state and the Organiser flag off these
// hooks; the room itself is never connected in a test.
const localParticipant = {
  metadata: null as string | null,
  setMicrophoneEnabled: vi.fn(),
  setCameraEnabled: vi.fn(),
  setScreenShareEnabled: vi.fn(),
}

vi.mock('@livekit/components-react', () => ({
  useRoomContext: () => ({ disconnect: vi.fn() }),
  useLocalParticipant: () => ({
    localParticipant,
    isMicrophoneEnabled: true,
    isCameraEnabled: true,
    isScreenShareEnabled: false,
  }),
}))

// Pulls in the krisp filter and track processors, neither of which loads in
// jsdom; the dialog is closed in every case here anyway.
vi.mock('@/components/room/settings-dialog', () => ({
  SettingsDialog: () => null,
}))

const eventContext: RoomEventContext = {
  title: 'A deliberately long weekly product sync title',
  startsAt: '2026-08-25T09:00:00.000Z',
  endsAt: '2026-08-25T10:00:00.000Z',
  recurring: true,
}

function renderBar(options: {
  organiser: boolean
  eventContext?: RoomEventContext
}) {
  localParticipant.metadata = options.organiser
    ? JSON.stringify({ organiser: true })
    : null
  const { container } = render(
    <ControlBar
      roomName="ab3k-x9q2"
      panel={null}
      onTogglePanel={vi.fn()}
      handRaised={false}
      onToggleHand={vi.fn()}
      onReaction={vi.fn()}
      onLeaveIntent={vi.fn()}
      eventContext={options.eventContext}
    />,
  )
  const region = (name: string) =>
    container.querySelector<HTMLElement>(`[data-region="${name}"]`)
  return {
    container,
    bar: container.querySelector<HTMLElement>('[data-region="center"]')
      ?.parentElement as HTMLElement,
    left: region('left'),
    center: region('center'),
    right: region('right'),
  }
}

/** The four cases the maintainer asked to be proved: role × event title. */
const CASES = [
  { name: 'guest, no event title', organiser: false, eventContext: undefined },
  { name: 'guest, with event title', organiser: false, eventContext },
  {
    name: 'organiser, no event title',
    organiser: true,
    eventContext: undefined,
  },
  { name: 'organiser, with event title', organiser: true, eventContext },
] as const

describe('ControlBar centering', () => {
  beforeEach(cleanup)

  it('lays the bar out as three tracks with equal, zero-minimum sides', () => {
    const { bar } = renderBar({ organiser: false })
    // A bare `1fr` resolves to `minmax(auto, 1fr)` and lets a long title in
    // the left region steal width from the centre; the explicit 0 minimum is
    // what keeps the two side tracks identical.
    expect(bar.className).toContain(
      'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
    )
    expect(bar.className).not.toContain('justify-between')
  })

  it.each(CASES)(
    'keeps the centre cluster identical: $name',
    ({ organiser, eventContext: context }) => {
      const { center } = renderBar({ organiser, eventContext: context })
      const labels = Array.from(center!.children).map((child) =>
        child.getAttribute('aria-label'),
      )
      expect(labels).toEqual([
        'Mute',
        'Turn camera off',
        'Share screen',
        'Raise hand',
        'Send a reaction',
        'Toggle people',
        'Toggle chat',
        'Settings',
        'Leave meeting',
      ])
    },
  )

  it('puts the Organiser-only End for all in the right region, not the centre', () => {
    const { center, right } = renderBar({ organiser: true })
    expect(right!.textContent).toContain('End for all')
    expect(center!.textContent).not.toContain('End for all')
  })

  it('renders the right region even for a guest, so the track never collapses', () => {
    const { right } = renderBar({ organiser: false })
    // An absent third track would hand its width to the centre and shift it.
    expect(right).not.toBeNull()
    expect(right!.textContent).toBe('')
  })

  it.each(CASES)(
    'keeps the side regions symmetrical in the layout: $name',
    ({ organiser, eventContext: context }) => {
      const { bar, left, right } = renderBar({
        organiser,
        eventContext: context,
      })
      // Both sides must be plain grid children — no flex-1, no fixed spacer
      // width, nothing that makes one side wider than the other.
      expect(left!.className).not.toMatch(/(^|\s)flex-1(\s|$)/)
      expect(right!.className).not.toMatch(/(^|\s)flex-1(\s|$)/)
      // The old fixed `w-24` spacer never matched the growing left cluster.
      expect(right!.className).not.toMatch(/(^|\s)w-\d/)
      expect(bar.children).toHaveLength(3)
    },
  )
})
