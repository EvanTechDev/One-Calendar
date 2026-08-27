'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AuthFormProvider,
  LoginForm,
  ResetPasswordForm,
  SignUpForm,
  type AuthFormClient,
} from '@zntr/auth/forms'
import { Spinner } from '@zntr/ui/spinner'
import { oauthAuthClient } from '@/lib/auth/oauth-client'

type OAuthForm = 'login' | 'sign-up' | 'reset-password'

function OAuthAuthForm({ form }: { form: OAuthForm }) {
  const searchParams = useSearchParams()
  const signedNames = new Set(searchParams.getAll('ba_param'))
  const signedParams = new URLSearchParams()
  for (const [name, value] of searchParams.entries()) {
    if (name === 'sig' || name === 'ba_param' || signedNames.has(name)) {
      signedParams.append(name, value)
    }
  }
  const query = signedParams.toString()
  const withQuery = (path: string) => (query ? `${path}?${query}` : path)

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
          signIn: withQuery('/oauth/sign-in'),
          signUp: withQuery('/oauth/sign-up'),
          resetPassword: withQuery('/oauth/reset-password'),
        },
      }}
    >
      {form === 'login' ? <LoginForm /> : null}
      {form === 'sign-up' ? <SignUpForm /> : null}
      {form === 'reset-password' ? (
        <ResetPasswordForm token={searchParams.get('token')} />
      ) : null}
    </AuthFormProvider>
  )
}

export function OAuthAuthFormHost({ form }: { form: OAuthForm }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="size-8" />
        </div>
      }
    >
      <OAuthAuthForm form={form} />
    </Suspense>
  )
}
