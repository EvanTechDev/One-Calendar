// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccountPanel, AccountProvider } from '@zntr/auth/account'
import type { AccountContextValue } from '@zntr/auth/account'
import { selectAuthCopy } from '@zntr/i18n/auth'

/**
 * "Loading" is not "signed out".
 *
 * The panel decided from `Boolean(user)` alone, and `authClient.useSession()`
 * returns `undefined` data while it resolves. So opening the Account tab showed the
 * signed-out state — Sign in and Sign up buttons — for as long as the session
 * request took, and then replaced it with the real panel.
 *
 * The original dropdown had the same flaw and got away with it: it is small, and a
 * brief flicker in a menu reads as a menu opening. A full settings panel telling
 * you to sign in when you are signed in does not.
 *
 * Three states, not two. Conflating the first two is the bug.
 */
const client = {
  updateUser: vi.fn(async () => ({ data: {}, error: null })),
  signOut: vi.fn(async () => ({ data: {}, error: null })),
} as unknown as AccountContextValue['client']

const base = {
  copy: selectAuthCopy('en'),
  client,
  refetchSession: async () => {},
  navigate: vi.fn(),
  deleteAccount: async () => ({ ok: true as const }),
  signInHref: '/sign-in',
}

const USER = {
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  image: null,
  emailVerified: true,
}

const mount = (value: Partial<AccountContextValue>) =>
  render(
    <AccountProvider
      value={{ ...base, user: null, ...value } as AccountContextValue}
    >
      <AccountPanel />
    </AccountProvider>,
  )

beforeEach(() => vi.clearAllMocks())

describe('while the session is loading', () => {
  it('offers neither sign-in nor sign-up', () => {
    // The reported symptom: those buttons appearing for a signed-in user.
    mount({ user: null, isLoading: true })
    expect(screen.queryByRole('button', { name: /^sign in$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^sign up$/i })).toBeNull()
  })

  it('does not render the account form either', () => {
    // Rendering the form with a null user would show empty name fields and an
    // avatar placeholder, then snap to the real values — the same flicker
    // wearing different clothes.
    mount({ user: null, isLoading: true })
    expect(screen.queryByLabelText(/first name/i)).toBeNull()
  })

  it('reserves the space the panel will occupy', () => {
    // A skeleton, not nothing: an empty tab that suddenly fills pushes the
    // dialog's height around and moves whatever the user was about to click.
    const { container } = mount({ user: null, isLoading: true })
    expect(container.querySelector('[data-account-loading]')).not.toBeNull()
  })
})

describe('once the session resolves', () => {
  it('shows the account form for a signed-in user', () => {
    mount({ user: USER, isLoading: false })
    expect(screen.getByDisplayValue('Ada')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^sign up$/i })).toBeNull()
  })

  it('shows sign-in and sign-up for a genuinely signed-out visitor', () => {
    // Still reachable: this is the state the flicker was borrowing from, and it
    // has to keep working.
    mount({ user: null, isLoading: false })
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeTruthy()
  })

  it('treats an absent isLoading as resolved', () => {
    // Every existing caller omits it. Defaulting to "loading" would leave those
    // callers rendering a skeleton forever.
    mount({ user: USER })
    expect(screen.getByDisplayValue('Ada')).toBeTruthy()
  })

  it('prefers the user over a stale loading flag', () => {
    // Better Auth can report isPending during a background refetch while holding
    // the previous session. Blanking a populated panel mid-use would be worse
    // than the flicker being fixed.
    mount({ user: USER, isLoading: true })
    expect(screen.getByDisplayValue('Ada')).toBeTruthy()
  })
})

describe('a server-rendered initial user', () => {
  it('skips the loading state entirely', () => {
    // An app that already read the session on the server should not make the panel
    // read it again before showing anything. Meet renders its header from a server
    // session, so it can hand the panel a user that is correct on first paint —
    // there is no interval during which the panel knows less than the page does.
    mount({ user: USER, isLoading: true })
    expect(screen.getByDisplayValue('Ada')).toBeTruthy()
    expect(document.querySelector('[data-account-loading]')).toBeNull()
  })
})
