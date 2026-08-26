'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * What the shared auth forms need from the app mounting them.
 *
 * The forms themselves are identical in both apps (ADR 0022); everything that
 * differs is here. Passed by context rather than props because the 2FA step and
 * the OTP step are nested several levels deep, and threading a client through
 * every intermediate component is how one of them ends up with its own.
 */
/**
 * What Better Auth returns from every client call: data or an error, never both.
 *
 * Structural rather than imported from Better Auth: the plugin set differs per
 * app — meet has no reason to load sentinel — so the real client types are not
 * identical, and a shared component must not require them to be.
 */
type AuthResult<T = unknown> = {
  data: T | null
  error: { message?: string; code?: string; status?: number } | null
}

type AuthCall<A> = (args: A) => Promise<AuthResult<never>>

export type AuthFormClient = {
  signIn: {
    email: AuthCall<{
      email: string
      password: string
      rememberMe?: boolean
      turnstileToken?: string
    }>
  }
  signUp: {
    email: AuthCall<{
      name: string
      email: string
      password: string
      callbackURL?: string
      turnstileToken?: string
    }>
  }
  requestPasswordReset: AuthCall<{ email: string; redirectTo?: string }>
  resetPassword: AuthCall<{ newPassword: string; token: string }>
  /**
   * Optional because both are plugins. A form that needs one checks first — an
   * app can legitimately run without 2FA or email OTP, and the shared component
   * must degrade rather than crash.
   */
  twoFactor?: {
    verifyTotp: AuthCall<{ code: string; trustDevice?: boolean }>
  }
  emailOtp?: {
    sendVerificationOtp: AuthCall<{ email: string; type: string }>
    verifyEmail: AuthCall<{ email: string; otp: string }>
    resetPassword?: AuthCall<{
      email: string
      otp: string
      password: string
    }>
  }
}

export type AuthFormRoutes = {
  /** Where a signed-in user lands. The calendar uses /app, meet its dashboard. */
  home: string
  signIn: string
  signUp: string
  resetPassword: string
}

export type AuthFormBrand = {
  /** Shown beside the logo in the layout. */
  appName: string
  /** One line under the name on the marketing panel. */
  blurb: string
}

export type AuthFormContextValue = {
  client: AuthFormClient
  routes: AuthFormRoutes
  brand: AuthFormBrand
  /**
   * In-app navigation. Supplied by the app because the forms cannot import
   * `next/navigation` and still be testable, and because an absolute URL needs a
   * full page load rather than a router push — `returnTo` may point at the
   * sibling app, which the router cannot reach.
   */
  navigate: (to: string) => void
}

const AuthFormContext = createContext<AuthFormContextValue | null>(null)

export function AuthFormProvider(props: {
  value: AuthFormContextValue
  children: ReactNode
}) {
  return (
    <AuthFormContext.Provider value={props.value}>
      {props.children}
    </AuthFormContext.Provider>
  )
}

export function useAuthForm(): AuthFormContextValue {
  const value = useContext(AuthFormContext)
  if (!value) {
    // Throws rather than falling back to a default client. A default would make
    // a forgotten provider look like a working form that silently authenticates
    // against the wrong origin.
    throw new Error(
      'Auth forms must be rendered inside <AuthFormProvider>. ' +
        'The mounting app supplies its own Better Auth client and routes.',
    )
  }
  return value
}
