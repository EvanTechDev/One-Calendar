import { createRoot } from 'react-dom/client'
import {
  AuthFormProvider,
  LoginForm,
  SignUpForm,
  ResetPasswordForm,
  type AuthFormClient,
} from '@zntr/auth/forms'
import { DesktopState } from '../../../apps/calendar-client/src/desktop-surfaces'
import { DesktopUpdates } from '../../../apps/calendar-client/src/updates'
import { NoInternet } from '@zntr/ui/calendar/components/connection-boundary'
import '@fontsource-variable/geist'
import '@fontsource-variable/inter'
import '@fontsource-variable/instrument-sans'
import '../../../apps/calendar-client/src/styles.css'
import '../../../apps/calendar-client/src/App.css'

const params = new URLSearchParams(location.search)
const surface = params.get('surface')
document.documentElement.classList.toggle(
  'dark',
  params.get('theme') === 'dark',
)
const config = {
  environment: 'dev' as const,
  apiOrigin: 'https://precal.xyehr.cn',
  appName: 'Zentra Calendar Dev',
  version: '0.1.0',
}
const success = async () => ({ data: null, error: null })
const client: AuthFormClient = {
  signIn: { email: success },
  signUp: { email: success },
  requestPasswordReset: success,
  resetPassword: success,
}
const routes = {
  home: '/',
  signIn: '/?surface=sign-in',
  signUp: '/?surface=sign-up',
  resetPassword: '/?surface=reset-password',
}
createRoot(document.getElementById('root')!).render(
  surface === 'settings' ? (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-8 text-2xl font-semibold">Desktop settings</h1>
      <DesktopUpdates config={config} />
    </main>
  ) : surface === 'offline' ? (
    <main>
      <NoInternet retry={() => {}} />
    </main>
  ) : surface === 'failed' ? (
    <DesktopState failed />
  ) : (
    <main>
      <AuthFormProvider
        value={{
          client,
          routes,
          brand: { appName: 'Zentra Calendar', blurb: 'Your day, in view.' },
          navigate: (to) => location.assign(to),
        }}
      >
        {surface === 'sign-up' ? (
          <SignUpForm />
        ) : surface === 'reset-password' ? (
          <ResetPasswordForm />
        ) : (
          <LoginForm />
        )}
      </AuthFormProvider>
    </main>
  ),
)
