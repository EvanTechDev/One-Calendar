import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { ControlBar } from '@/components/room/control-bar'
import {
  MOBILE_CONTROL_COUNT,
  mobileBarHeight,
  portraitStageIsUsable,
} from '@/lib/control-layout'

/**
 * The phone bar was two rows of identically-sized circles: six secondary
 * toggles above, four primary controls below. Everything looked equally
 * important — Settings carried the microphone's visual weight — and it cost
 * 112px of a 640px viewport to say so.
 *
 * It is one row of five now, with the rest behind More as a labelled grid. These
 * assert the structure that produces that, since jsdom cannot measure it.
 */
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

vi.mock('@/components/room/settings-dialog', () => ({
  SettingsDialog: () => null,
}))

const handlers = {
  onTogglePanel: vi.fn(),
  onToggleHand: vi.fn(),
  onReaction: vi.fn(),
  onLeaveIntent: vi.fn(),
}

function renderBar(overrides: { unreadChat?: number } = {}) {
  localParticipant.metadata = null
  const { container } = render(
    <ControlBar
      roomName="ab3k-x9q2"
      panel={null}
      handRaised={false}
      {...handlers}
      unreadChat={overrides.unreadChat}
    />,
  )
  return {
    container,
    center: container.querySelector<HTMLElement>('[data-region="center"]')!,
  }
}

function openMore() {
  fireEvent.click(screen.getByLabelText(/^More/))
}

beforeEach(() => {
  cleanup()
  Object.values(handlers).forEach((fn) => fn.mockClear())
})

describe('the phone control row', () => {
  it('shows exactly the five controls lib/control-layout budgets for', () => {
    const { center } = renderBar()
    const visible = Array.from(center.children)
      .map((child) => child.getAttribute('aria-label'))
      .filter((label) => label !== null)

    expect(visible).toHaveLength(MOBILE_CONTROL_COUNT)
    expect(visible).toEqual([
      'Mute',
      'Turn camera off',
      'Raise hand',
      'More',
      'Leave meeting',
    ])
  })

  it('leaves the stage more room than the two-row version did', () => {
    // 64px rather than 112px. The floor is 80%; this is the margin above it.
    expect(mobileBarHeight()).toBe(64)
    expect(portraitStageIsUsable(640)).toBe(true)
    expect(portraitStageIsUsable(844)).toBe(true)
  })

  it('promotes the hand but not Settings', () => {
    // Raising a hand is time-critical in a way that opening Settings is not;
    // that asymmetry is the hierarchy the old flat row of six lacked.
    const { center } = renderBar()
    expect(
      center.querySelector(':scope > [aria-label="Raise hand"]'),
    ).not.toBeNull()
    expect(center.querySelector(':scope > [aria-label="Settings"]')).toBeNull()
  })
})

describe('the More sheet', () => {
  it('holds the room code, which ADR 0019 makes the join link', () => {
    renderBar()
    openMore()
    // Scoped to the sheet: the desktop left region has its own copy, hidden by
    // a breakpoint class rather than removed from the DOM.
    const sheet = screen.getByRole('dialog')
    expect(sheet).toHaveTextContent('ab3k-x9q2')
    expect(
      sheet.querySelector('[aria-label="Copy invite link"]'),
    ).not.toBeNull()
  })

  it('labels every control, unlike a bare circle', () => {
    renderBar()
    openMore()
    for (const label of ['Share', 'People', 'Chat', 'Settings']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('closes when a control opens something behind it', () => {
    renderBar()
    openMore()
    fireEvent.click(screen.getByText('Chat'))

    // The chat panel renders behind the sheet, so leaving it up would hide what
    // the tap just opened.
    expect(handlers.onTogglePanel).toHaveBeenCalledWith('chat')
    expect(screen.queryByText('Send a reaction')).not.toBeInTheDocument()
  })

  it('stays open for reactions, which come in runs', () => {
    renderBar()
    openMore()
    fireEvent.click(screen.getByLabelText('React with 👍'))

    expect(handlers.onReaction).toHaveBeenCalledWith('👍')
    // Sending several is the normal way reactions are used; closing after one
    // would fight that.
    expect(screen.getByText('Send a reaction')).toBeInTheDocument()
  })

  it('surfaces unread chat on the trigger, since chat is inside', () => {
    renderBar({ unreadChat: 3 })
    // Without this an arriving message is invisible on a phone — the bug that
    // made chat look like it was losing messages in the first place.
    expect(screen.getByLabelText('More, 3 unread messages')).toBeInTheDocument()
  })

  it('reads as plain More when there is nothing unread', () => {
    renderBar()
    expect(screen.getByLabelText('More')).toBeInTheDocument()
  })
})
