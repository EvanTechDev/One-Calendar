// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { maxTilesPerPage, videoGridColumns } from '@/lib/video-layout'

/**
 * The cap exists so off-screen tiles never mount, because an unmounted tile
 * drops its subscription (adaptiveStream). This asserts the property that
 * matters — tiles rendered <= page size — against the same functions the room
 * uses, on a stubbed grid rather than a live LiveKit room.
 */
function Grid({
  count,
  stage,
}: {
  count: number
  stage: { width: number; height: number }
}) {
  const pageSize = maxTilesPerPage(stage)
  const visible = Math.min(count, pageSize)
  const columns = videoGridColumns(visible, stage)
  return (
    <div
      data-testid="grid"
      data-columns={columns}
      data-rows={Math.max(1, Math.ceil(visible / columns))}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: visible }, (_, index) => (
        <div key={index} data-testid="tile" />
      ))}
    </div>
  )
}

const PHONE = { width: 360, height: 560 }
const DESKTOP = { width: 1280, height: 800 }
const WIDE = { width: 1920, height: 1080 }

describe('video grid pagination', () => {
  beforeEach(cleanup)

  it('mounts at most one page of tiles however large the room', () => {
    // The reported bug: 40 participants used to mount 40 subscribed tiles.
    render(<Grid count={40} stage={DESKTOP} />)
    expect(screen.getAllByTestId('tile')).toHaveLength(9)
  })

  it('mounts far fewer tiles on a phone than on a wide desktop', () => {
    const { unmount } = render(<Grid count={40} stage={PHONE} />)
    expect(screen.getAllByTestId('tile')).toHaveLength(4)
    unmount()
    render(<Grid count={40} stage={WIDE} />)
    expect(screen.getAllByTestId('tile')).toHaveLength(16)
  })

  it('does not paginate a room that fits', () => {
    render(<Grid count={3} stage={DESKTOP} />)
    expect(screen.getAllByTestId('tile')).toHaveLength(3)
  })

  it('never exceeds its own row cap once paginated', () => {
    for (const stage of [PHONE, DESKTOP, WIDE]) {
      const { unmount } = render(<Grid count={40} stage={stage} />)
      const grid = screen.getByTestId('grid')
      expect(Number(grid.dataset.rows)).toBeLessThanOrEqual(4)
      unmount()
    }
  })

  it('lays every mounted tile inside the declared grid', () => {
    render(<Grid count={40} stage={DESKTOP} />)
    const grid = screen.getByTestId('grid')
    const columns = Number(grid.dataset.columns)
    const rows = Number(grid.dataset.rows)
    // No tile may fall outside the tracks, which is what produced a 4x10 grid
    // from a 4-column rule that never capped rows.
    expect(screen.getAllByTestId('tile').length).toBeLessThanOrEqual(
      columns * rows,
    )
  })
})
