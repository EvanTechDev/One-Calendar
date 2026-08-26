import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ControlBar } from '@/components/room/control-bar'
import {
  MOBILE_BAR_PADDING,
  TAILWIND_STEP,
  TOUCH_TARGET,
  controlBarFits,
} from '@/lib/control-layout'
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
    bar: region('center')?.parentElement as HTMLElement,
    left: region('left'),
    center: region('center'),
    centerSecondary: region('center-secondary'),

    right: region('right'),
  }
}

/**
 * The secondary toggles, in the order they are meant to appear.
 *
 * The hand is no longer among them: it was promoted to the phone's own row,
 * because raising a hand is time-critical in a way that opening Settings is not.
 */
const SECONDARY_LABELS = [
  'Share screen',
  'Send a reaction',
  'Toggle people',
  'Toggle chat',
  'Settings',
]

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
      'sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
    )
    expect(bar.className).toContain('sm:grid')
    expect(bar.className).not.toContain('justify-between')
  })

  it('turns the centring grid off below sm, where there is no left region', () => {
    const { bar, center } = renderBar({ organiser: false })
    // A phone hides the left region, so the grid only cost the controls half
    // the viewport for an empty third track — which is what forced six
    // controls into a dropdown. Every grid class is `sm:`-prefixed.
    for (const className of bar.className.split(/\s+/)) {
      if (className.startsWith('grid')) {
        expect(className, 'unprefixed grid class').toBe('')
      }
    }
    expect(bar.className).toContain('flex')
    // And the controls claim the freed width rather than sitting in a track.
    expect(center!.className).toContain('flex-1')
    expect(center!.className).toContain('sm:flex-none')
  })

  it.each(CASES)(
    'keeps the centre cluster identical: $name',
    ({ organiser, eventContext: context }) => {
      const { center, centerSecondary } = renderBar({
        organiser,
        eventContext: context,
      })
      // Whatever the role or title, the centre track holds exactly the same
      // controls — that is what makes its measured width role-independent.
      const labels = Array.from(center!.children).map((child) =>
        child.getAttribute('aria-label'),
      )
      expect(labels).toEqual([
        'Mute',
        'Turn camera off',
        'Raise hand',
        null, // the sm-and-up secondary cluster
        'More',
        'Leave meeting',
      ])
      expect(
        Array.from(centerSecondary!.children).map((child) =>
          child.getAttribute('aria-label'),
        ),
      ).toEqual(SECONDARY_LABELS)
    },
  )

  it.each(CASES)(
    'keeps the phone row identical too: $name',
    ({ organiser, eventContext: context }) => {
      const { center } = renderBar({ organiser, eventContext: context })
      // The phone's row is role-independent for the same reason the desktop
      // centre track is: End for all is not in it. Its visible contents are the
      // centre track's children minus the `sm`-only secondary cluster.
      const phoneLabels = Array.from(center!.children)
        .map((child) => child.getAttribute('aria-label'))
        .filter((label) => label !== null)
      expect(phoneLabels).toEqual([
        'Mute',
        'Turn camera off',
        'Raise hand',
        'More',
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

  it('keeps mic, camera and leave visible at every width', () => {
    const { center } = renderBar({ organiser: false })
    // These three are direct children of the centre track, so no breakpoint
    // class can hide them.
    for (const label of ['Mute', 'Turn camera off', 'Leave meeting']) {
      const button = center!.querySelector(`:scope > [aria-label="${label}"]`)
      expect(button, label).not.toBeNull()
      expect(button!.className).not.toMatch(/(^|\s)hidden(\s|$)/)
    }
  })

  it('shows the secondary toggles inline from sm, behind More below it', () => {
    const { center, centerSecondary } = renderBar({ organiser: false })
    // Exactly one route to them at any width, so no control is duplicated on
    // screen or missing from it.
    expect(centerSecondary!.className).toContain('hidden')
    expect(centerSecondary!.className).toContain('sm:flex')

    const more = center!.querySelector('[aria-label="More"]')
    expect(more!.className).toContain('sm:hidden')

    // The desktop cluster still carries every one of them.
    for (const label of SECONDARY_LABELS) {
      expect(
        centerSecondary!.querySelector(`[aria-label="${label}"]`),
        label,
      ).not.toBeNull()
    }
  })

  it('renders the touch target lib/control-layout budgets for', () => {
    const { bar, center } = renderBar({ organiser: false })
    // The budget is in pixels and the class must be a literal for Tailwind to
    // emit it, so the two can drift. This is the seam that catches it.
    const sizeClass = `size-${TOUCH_TARGET / TAILWIND_STEP}`
    const paddingClass = `px-${MOBILE_BAR_PADDING / TAILWIND_STEP}`
    expect(bar.className).toContain(paddingClass)
    expect(center!.firstElementChild!.className).toContain(sizeClass)
    // And the arithmetic those classes feed says both target viewports work.
    expect(controlBarFits(360) && controlBarFits(390)).toBe(true)
  })

  it('gives every phone control a 44px touch target', () => {
    const { center, right } = renderBar({ organiser: true })
    // 44px is the iOS minimum; these were 32px. `size-11` is 2.75rem = 44px.
    const phoneTargets = [
      ...Array.from(center!.children).filter(
        (child) => child.getAttribute('aria-label') !== null,
      ),
      ...Array.from(right!.children),
    ]
    expect(phoneTargets.length).toBeGreaterThan(0)
    for (const button of phoneTargets) {
      expect(
        button.className,
        button.getAttribute('aria-label') ?? '',
      ).toContain('size-11')
    }
  })

  it('holds the destructive Leave away from the toggles on a phone', () => {
    const { center } = renderBar({ organiser: false })
    const leave = center!.querySelector('[aria-label="Leave meeting"]')!
    const mute = center!.querySelector(':scope > [aria-label="Mute"]')!

    // Leaving the call used to be one 8px gap from muting. The margin is
    // phone-only — `sm:ml-0` keeps the desktop centre track's width unchanged,
    // which is what the centring invariants above depend on.
    expect(leave.className).toContain('ml-4')
    expect(leave.className).toContain('sm:ml-0')
    expect(mute.className).not.toContain('ml-4')
  })

  it('keeps the room code reachable on a phone', () => {
    const { center } = renderBar({ organiser: false })
    // ADR 0019: the code is the join link, so losing access to it on a phone
    // would be a regression whatever the layout. It lives behind More.
    const more = center!.querySelector('[aria-label="More"]')
    expect(more).not.toBeNull()
    expect(more!.className).toContain('sm:hidden')
  })

  it('still names the meeting, in the left region from sm up', () => {
    const { left, container } = renderBar({ organiser: false, eventContext })
    // The identity block deliberately has no row of its own — that cost ~34px
    // of a 640px viewport. On a phone it lives in the More sheet instead.
    expect(left!.textContent).toContain(eventContext.title)
    expect(container.textContent).toContain(eventContext.title)
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
