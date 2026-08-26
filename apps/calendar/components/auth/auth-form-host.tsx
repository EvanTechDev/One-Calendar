'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  AuthFormProvider,
  type AuthFormClient,
} from '@zntr/auth/forms'
import { authClient } from '@/lib/auth/client'

/**
 * This app's half of the shared auth forms.
 *
 * The forms themselves live in `@zntr/auth` and are identical in both apps; what
 * differs is the Better Auth client, the four routes, and the brand (ADR 0022).
 * Supplying them here is what keeps the package free of any `next/navigation`
 * import — which is also what makes the forms testable.
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
          home: '/app',
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
