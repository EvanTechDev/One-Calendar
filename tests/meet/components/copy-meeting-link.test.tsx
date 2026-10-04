import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { toast } from 'sonner'
import { HomeSection } from '@/components/dashboard/home-section'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderHome(writeText: ReturnType<typeof vi.fn>) {
  vi.stubGlobal(
    'navigator',
    Object.create(navigator, {
      clipboard: { value: { writeText } },
    }),
  )
  render(
    <HomeSection
      upcoming={{
        failed: false,
        rows: [
          {
            meetingId: 'ab3k-x9q2',
            eventId: 'event-1',
            title: 'Weekly standup',
            startDate: new Date(Date.now() + 3_600_000).toISOString(),
            endDate: new Date(Date.now() + 7_200_000).toISOString(),
          },
        ],
      }}
      recentPreview={null}
      onSectionChange={vi.fn()}
    />,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('copying the next meeting link', () => {
  it('copies the room on this origin and confirms success on the control', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    renderHome(writeText)
    const copy = screen.getByRole('button', { name: 'Copy link for ab3k-x9q2' })
    fireEvent.click(copy)
    await waitFor(() => expect(copy).toHaveAttribute('title', 'Link copied'))
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/ab3k-x9q2`,
    )
    expect(toast.success).toHaveBeenCalledWith('Meeting link copied')
  })

  it('reports a clipboard failure and lets the user retry', async () => {
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValue(undefined)
    renderHome(writeText)
    const copy = screen.getByRole('button', { name: 'Copy link for ab3k-x9q2' })
    fireEvent.click(copy)
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(copy).toHaveAttribute('title', 'Copy meeting link')
    expect(toast.success).not.toHaveBeenCalled()
    fireEvent.click(copy)
    await waitFor(() => expect(copy).toHaveAttribute('title', 'Link copied'))
  })
})
