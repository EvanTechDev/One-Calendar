import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useCalendarHost } from '@zntr/utils/calendar-host'
import { CalendarWebHost } from '@/components/providers/calendar-web-host'

const state = vi.hoisted(() => ({
  session: {
    data: { user: { id: 'alex', name: 'Alex', email: 'alex@example.com' } } as {
      user: { id: string; name: string; email: string }
    } | null,
    isPending: false,
    error: null as Error | null,
  },
  router: { push: vi.fn(), replace: vi.fn() },
}))
vi.mock('@/lib/auth/client', () => ({
  authClient: { useSession: () => state.session },
}))
vi.mock('next/navigation', () => ({ useRouter: () => state.router }))

function Calendar() {
  const { session } = useCalendarHost()
  const [draft, setDraft] = useState('Draft')
  return (
    <>
      <p>{session.data?.user.name ?? 'Signed out'}</p>
      <input
        aria-label="Draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </>
  )
}

beforeEach(() => {
  state.session = {
    data: { user: { id: 'alex', name: 'Alex', email: 'alex@example.com' } },
    isPending: false,
    error: null,
  }
})

it('retains the last confirmed identity and draft during session refresh failures, but honors logout', () => {
  const tree = () => (
    <CalendarWebHost>
      <Calendar />
    </CalendarWebHost>
  )
  const view = render(tree())
  const input = screen.getByLabelText('Draft')
  fireEvent.change(input, { target: { value: 'Unfinished meeting' } })
  state.session = { data: null, isPending: true, error: null }
  view.rerender(tree())
  expect(screen.getByText('Alex')).toBeVisible()
  state.session = {
    data: null,
    isPending: false,
    error: new TypeError('Failed to fetch'),
  }
  view.rerender(tree())
  expect(screen.getByText('Alex')).toBeVisible()
  expect(screen.getByLabelText('Draft')).toBe(input)
  expect(input).toHaveValue('Unfinished meeting')
  state.session = { data: null, isPending: false, error: null }
  view.rerender(tree())
  expect(screen.getByText('Signed out')).toBeVisible()
  expect(state.router.replace).not.toHaveBeenCalled()
  view.unmount()
})
