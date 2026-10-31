'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { AuthFormProvider, type AuthFormClient } from '@zntr/auth/forms'
import { authClient } from '@/lib/auth/client'

/**
 * This app's half of the shared auth forms.
 *
 * The forms live in `@zntr/auth` and are byte-identical to the calendar's; only
 * the client, the routes and the brand differ (ADR 0022). `home` is the dashboard
 * rather than the calendar's `/app` — the literal that used to be hard-coded in
 * the form would have sent every new meet user to a route this app does not have.
 */
export function AuthFormHost({ children }: { children: ReactNode }) {
  const router = useRouter()

  return (
    <AuthFormProvider
      value={{
        client: authClient as unknown as AuthFormClient,
        navigate: (to) => router.push(to),
        brand: {
          appName: 'Zentra',
          blurb: 'Zentra is a free and open source workspace that helps you.',
        },
        routes: {
          home: '/',
          signIn: '/sign-in',
          signUp: '/sign-up',
          resetPassword: '/reset-password',
        },
      }}
    >
      {children}
    </AuthFormProvider>
  )
}
