import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useScrollLock } from '@zntr/ui/calendar/hooks/use-scroll-lock'

/**
 * `RemoveScroll` cancels `wheel` and `touch*` at the document level and nothing
 * else, so the calendar grid it sits inside stayed scrollable by keyboard, by
 * scrollbar drag, and by focus pulling an off-screen control into view. This is
 * the other half of the lock — the one that takes the container away.
 */

function Toggle({
  containerRef,
  startLocked = false,
}: {
  containerRef: { current: HTMLDivElement | null }
  startLocked?: boolean
}) {
  const [locked, setLocked] = useState(startLocked)
  useScrollLock(containerRef, locked)
  return (
    <button onClick={() => setLocked((value) => !value)}>
      {locked ? 'unlock' : 'lock'}
    </button>
  )
}

function renderWithToggle(startLocked = false) {
  const containerRef = { current: null as HTMLDivElement | null }
  const utils = render(
    <div ref={(el) => (containerRef.current = el)}>
      <Toggle containerRef={containerRef} startLocked={startLocked} />
    </div>,
  )
  return {
    ...utils,
    container: containerRef.current as HTMLDivElement,
  }
}

describe('useScrollLock', () => {
  it('freezes the container while active and restores it after', () => {
    const { container, getByText } = renderWithToggle()
    expect(container.style.overflow).toBe('')

    act(() => getByText('lock').click())
    expect(container.style.overflow).toBe('hidden')

    act(() => getByText('unlock').click())
    expect(container.style.overflow).toBe('')
  })

  it('freezes on mount when already active, for an overlay open on first paint', () => {
    const { container } = renderWithToggle(true)
    expect(container.style.overflow).toBe('hidden')
  })

  // The container takes away its own scrollbar while locked, which would
  // otherwise nudge the whole grid sideways.
  it('holds the scrollbar gutter open while locked', () => {
    const { container, getByText } = renderWithToggle()

    act(() => getByText('lock').click())
    expect(container.style.scrollbarGutter).toBe('stable')

    act(() => getByText('unlock').click())
    expect(container.style.scrollbarGutter).toBe('')
  })

  // A ref that has not resolved yet, or a caller that passes no ref at all,
  // must be a no-op — not a crash, and not a locked page with no way back.
  it('is a no-op when there is no container to lock', () => {
    function Orphan() {
      useScrollLock({ current: null }, true)
      return null
    }
    function NoRef() {
      useScrollLock(undefined, true)
      return null
    }
    expect(() => {
      render(
        <>
          <Orphan />
          <NoRef />
        </>,
      )
    }).not.toThrow()
  })
})
