import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  cleanup,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react'

/**
 * The New meeting dialog's start and join behaviour.
 *
 * The dialog is the only way a signed-in user reaches these actions now, so the
 * two things that must not regress are: a guest Organiser's Creator Token is
 * stored BEFORE navigating (ADR 0016 — the token is the sole credential for
 * their authority), and a pasted invite link's hash reaches the room (it carries
 * the E2EE passphrase).
 */

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { NewMeetingDialog } =
  await import('@/components/dashboard/new-meeting-dialog')

const STORAGE_KEY = 'zentra-meet-creator-tokens'

function creatorTokens(): Record<string, string> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
}

function mockCreate(body: Record<string, unknown>, ok = true) {
  const fetchMock = vi.fn(async () => ({
    ok,
    json: async () => body,
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function open() {
  const onOpenChange = vi.fn()
  render(<NewMeetingDialog open onOpenChange={onOpenChange} />)
  return { onOpenChange }
}

beforeEach(() => {
  localStorage.clear()
  push.mockClear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('NewMeetingDialog', () => {
  it('offers start, the encryption choice, and join in one dialog', () => {
    open()
    expect(
      screen.getByRole('button', { name: /Start an instant meeting/ }),
    ).toBeTruthy()
    expect(
      screen.getByRole('switch', { name: /End-to-end encryption/ }),
    ).toBeTruthy()
    expect(screen.getByLabelText('Meeting code or link')).toBeTruthy()
  })

  it('stores the guest Creator Token before navigating into the room', async () => {
    mockCreate({
      id: 'ab3k-x9q2',
      joinPath: '/ab3k-x9q2',
      creatorToken: 'secret-token',
    })
    open()
    fireEvent.click(
      screen.getByRole('button', { name: /Start an instant meeting/ }),
    )
    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(creatorTokens()['ab3k-x9q2']).toBe('secret-token')
    expect(push).toHaveBeenCalledWith('/ab3k-x9q2')
  })

  it('appends an encryption passphrase hash when E2EE is on', async () => {
    mockCreate({ id: 'ab3k-x9q2', joinPath: '/ab3k-x9q2' })
    open()
    fireEvent.click(
      screen.getByRole('switch', { name: /End-to-end encryption/ }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Start an instant meeting/ }),
    )
    await waitFor(() => expect(push).toHaveBeenCalled())
    const target = push.mock.calls[0]![0] as string
    expect(target.startsWith('/ab3k-x9q2#')).toBe(true)
    expect(target.length).toBeGreaterThan('/ab3k-x9q2#'.length)
  })

  it('says chat is not saved once encryption is on (ADR 0020)', () => {
    open()
    expect(screen.getByText(/Chat is saved/)).toBeTruthy()
    fireEvent.click(
      screen.getByRole('switch', { name: /End-to-end encryption/ }),
    )
    expect(screen.getByText(/chat is not saved/)).toBeTruthy()
  })

  it('closes itself once a meeting has been started', async () => {
    mockCreate({ id: 'ab3k-x9q2', joinPath: '/ab3k-x9q2' })
    const { onOpenChange } = open()
    fireEvent.click(
      screen.getByRole('button', { name: /Start an instant meeting/ }),
    )
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('keeps Join disabled until the input is a real room code', () => {
    open()
    const join = screen.getByRole('button', { name: 'Join' })
    expect(join).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Meeting code or link'), {
      target: { value: 'nonsense' },
    })
    expect(join).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Meeting code or link'), {
      target: { value: 'ab3k-x9q2' },
    })
    expect(join).toBeEnabled()
  })

  it('joins a bare code and closes', () => {
    const { onOpenChange } = open()
    fireEvent.change(screen.getByLabelText('Meeting code or link'), {
      target: { value: 'ab3k-x9q2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(push).toHaveBeenCalledWith('/ab3k-x9q2')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  // Dropping the hash lands the user in an encrypted room without the key.
  it('carries a pasted link’s query and E2EE hash into the room', () => {
    open()
    fireEvent.change(screen.getByLabelText('Meeting code or link'), {
      target: {
        value: 'https://meet.example.com/ab3k-x9q2?hq=true#pass-phrase',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(push).toHaveBeenCalledWith('/ab3k-x9q2?hq=true#pass-phrase')
  })

  it('does not navigate when the meeting could not be created', async () => {
    mockCreate({ error: 'Rate limited' }, false)
    open()
    fireEvent.click(
      screen.getByRole('button', { name: /Start an instant meeting/ }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Start an instant meeting/ }),
      ).toBeEnabled(),
    )
    expect(push).not.toHaveBeenCalled()
    expect(creatorTokens()).toEqual({})
  })
})
