// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { AccountPanel, AccountProvider } from '@zntr/auth/account'
import type { AccountContextValue } from '@zntr/auth/account'
import { selectAuthCopy } from '@zntr/i18n/auth'

/**
 * The account panel, mounted by both apps.
 *
 * Account management used to be 955 lines inside the calendar's
 * user-profile-button, which was both the avatar dropdown AND the settings panel.
 * Only the panel is shared: the dropdown belongs to the calendar's chrome
 * (ADR 0022).
 *
 * These pin the seams that let two apps mount it — chiefly that deleting an
 * account calls the MOUNTING app's endpoint. The calendar's DELETE /api/account
 * removes calendar_events, settings and categories, which meet has no business
 * knowing about, so the path cannot be a literal in shared code.
 */
const updateUser = vi.fn(async () => ({ data: {}, error: null }))
const signOut = vi.fn(async () => ({ data: {}, error: null }))
const requestEmailChange = vi.fn(async () => ({ data: {}, error: null }))
const changeEmail = vi.fn(async () => ({ data: {}, error: null }))
const refetchSession = vi.fn(async () => {})
const navigate = vi.fn()
const deleteAccount = vi.fn(async () => ({ ok: true as const }))

const value = (
  over?: Partial<AccountContextValue>,
): AccountContextValue => ({
  copy: selectAuthCopy('en'),
  user: {
    id: 'u1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    image: null,
    emailVerified: true,
    twoFactorEnabled: false,
  },
  client: {
    updateUser,
    signOut,
    emailOtp: { requestEmailChange, changeEmail },
  } as unknown as AccountContextValue['client'],
  refetchSession,
  navigate,
  deleteAccount,
  signInHref: '/sign-in',
  ...over,
})

const mount = (over?: Partial<AccountContextValue>) =>
  render(
    <AccountProvider value={value(over)}>
      <AccountPanel />
    </AccountProvider>,
  )

beforeEach(() => vi.clearAllMocks())

describe('AccountProvider', () => {
  it('refuses to render the panel without one', () => {
    // A default would silently act on the wrong app's account endpoint.
    expect(() => render(<AccountPanel />)).toThrow(/AccountProvider/)
  })
})

describe('AccountPanel', () => {
  it('shows the signed-in identity', () => {
    mount()
    expect(screen.getByDisplayValue('Ada')).toBeTruthy()
    // Appears in more than one place (the summary row and the detail), which is
    // the panel's design rather than a duplication bug.
    expect(screen.getAllByText(/ada@example\.com/).length).toBeGreaterThan(0)
  })

  it('saves a changed name through the client', async () => {
    mount()
    fireEvent.change(screen.getByDisplayValue('Ada'), {
      target: { value: 'Grace' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateUser).toHaveBeenCalled())
    const arg = updateUser.mock.calls[0][0] as Record<string, unknown>
    expect(String(arg.name)).toContain('Grace')
  })

  it('deletes through the mounting app, not a hard-coded path', async () => {
    // The calendar's endpoint removes calendar_events, settings and categories;
    // meet's removes nothing of the sort. Shared code cannot name either.
    mount()
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }))

    const confirm = await screen.findByRole('textbox', {
      name: /delete|confirm/i,
    })
    fireEvent.change(confirm, { target: { value: 'DELETE MY ACCOUNT' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1))
  })

  it('requires the exact confirmation phrase before deleting', async () => {
    // The one irreversible action in the panel.
    mount()
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }))

    const confirm = await screen.findByRole('textbox', {
      name: /delete|confirm/i,
    })
    fireEvent.change(confirm, { target: { value: 'delete' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    await new Promise((r) => setTimeout(r, 20))
    expect(deleteAccount).not.toHaveBeenCalled()
  })

  it('sends the user to the app\u2019s own sign-in after signing out', async () => {
    mount({ signInHref: '/login' })
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => expect(signOut).toHaveBeenCalled())
    expect(navigate).toHaveBeenCalledWith('/login')
  })

  it('renders in the caller\u2019s language', () => {
    // Both apps mount this; a language that worked in one and not the other would
    // be a difference between two mounts of one component.
    mount({ copy: selectAuthCopy('de') })
    expect(screen.getByRole('button', { name: /speichern|profil/i })).toBeTruthy()
  })

  it('does not offer a 2FA control when the plugin is absent', () => {
    // twoFactor is a plugin. Offering a toggle that cannot work is worse than
    // omitting it.
    mount({
      client: {
        updateUser,
        signOut,
        emailOtp: { requestEmailChange, changeEmail },
      } as unknown as AccountContextValue['client'],
    })
    expect(
      screen.queryByRole('button', { name: /two-factor|2fa/i }),
    ).toBeNull()
  })
})
