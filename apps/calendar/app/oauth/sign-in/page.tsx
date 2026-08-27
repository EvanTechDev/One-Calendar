'use client'

import { AuthFormProvider, LoginForm } from '@zntr/auth/forms'
import type { AuthFormClient } from '@zntr/auth/forms'
import { oauthAuthClient } from '@/lib/auth/oauth-client'

export default function OAuthSignInPage() {
  return (
    <AuthFormProvider
      value={{
        client: oauthAuthClient as unknown as AuthFormClient,
        navigate: (to) => window.location.assign(to),
        brand: {
          appName: 'Zentra',
          blurb: 'Authorize secure access to your calendar.',
        },
        routes: {
          home: '/app',
          signIn: '/oauth/sign-in',
          signUp: '/sign-up',
          resetPassword: '/reset-password',
        },
      }}
    >
      <LoginForm />
    </AuthFormProvider>
  )
}
