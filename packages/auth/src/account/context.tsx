'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { AuthCopy } from '@zntr/i18n/auth'

/**
 * What the shared account panel needs from the app mounting it.
 *
 * Account management was 955 lines inside the calendar's user-profile-button,
 * which was both the avatar dropdown and the settings panel. Only the panel is
 * shared — the dropdown is the calendar's own chrome (ADR 0022).
 */

type AuthResult<T = unknown> = {
  data: T | null
  error: { message?: string; code?: string } | null
}

export type AccountUser = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  emailVerified?: boolean
  twoFactorEnabled?: boolean
}

export type AccountClient = {
  updateUser: (args: { name?: string; image?: string }) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
  emailOtp?: {
    requestEmailChange: (args: { newEmail: string }) => Promise<AuthResult>
    changeEmail: (args: {
      newEmail: string
      otp: string
    }) => Promise<AuthResult>
    sendVerificationOtp?: (args: {
      email: string
      type: string
    }) => Promise<AuthResult>
    resetPassword?: (args: {
      email: string
      otp: string
      password: string
    }) => Promise<AuthResult>
  }
  /**
   * Optional because it is a plugin. When absent the panel omits the 2FA row
   * entirely — offering a toggle that cannot work is worse than not offering one.
   */
  twoFactor?: {
    enable: (args: {
      password: string
    }) => Promise<AuthResult<{ totpURI: string }>>
    disable: (args: { password: string }) => Promise<AuthResult>
    /**
     * `trustDevice` is passed when confirming a fresh 2FA setup: the browser that
     * just proved possession of the authenticator should not be challenged again
     * on its next sign-in.
     */
    verifyTotp: (args: {
      code: string
      trustDevice?: boolean
    }) => Promise<AuthResult>
  }
}

export type AccountContextValue = {
  copy: AuthCopy
  user: AccountUser | null
  client: AccountClient
  /** Re-reads the session after a change the client cannot reflect locally. */
  refetchSession: () => Promise<void>
  navigate: (to: string) => void
  /**
   * Deletes the account, including whatever app-specific rows hang off it.
   *
   * A function rather than a URL because the work differs per app: the calendar's
   * endpoint removes calendar_events, settings, categories, countdowns and
   * bookmarks; meet's has none of those. Shared code cannot name either one, and
   * a literal '/api/account' here would silently do the wrong amount of deleting.
   */
  deleteAccount: () => Promise<{ ok: boolean; error?: string }>
  /** Where to land after signing out. */
  signInHref: string
}

const AccountContext = createContext<AccountContextValue | null>(null)

export function AccountProvider(props: {
  value: AccountContextValue
  children: ReactNode
}) {
  return (
    <AccountContext.Provider value={props.value}>
      {props.children}
    </AccountContext.Provider>
  )
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext)
  if (!value) {
    // Throws rather than defaulting: a default deleteAccount would either do
    // nothing or hit the wrong app's endpoint, and both look like success.
    throw new Error(
      'Account components must be rendered inside <AccountProvider>. ' +
        'The mounting app supplies its own client, copy and delete endpoint.',
    )
  }
  return value
}
