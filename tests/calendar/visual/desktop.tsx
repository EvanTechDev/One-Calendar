import { createRoot } from 'react-dom/client'
import {
  DesktopWelcome,
  DesktopAccount,
  DesktopNotice,
  DesktopState,
} from '../../../apps/calendar-client/src/desktop-surfaces'
import { DesktopUpdates } from '../../../apps/calendar-client/src/updates'
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
const session = {
  user: null,
  expiresAt: null,
  pending: surface === 'waiting',
  signingIn: surface === 'waiting',
  error: null,
  generation: 0,
}
const idle = () => {}
createRoot(document.getElementById('root')!).render(
  surface === 'settings' ? (
    <main style={{ maxWidth: 640, margin: '48px auto', padding: '0 32px' }}>
      <h1 style={{ fontSize: 24, marginBottom: 32 }}>Desktop settings</h1>
      <DesktopAccount
        user={{
          id: 'fixture',
          name: 'Alex Chen',
          email: 'alex@example.invalid',
        }}
        onManage={idle}
        onSignOut={idle}
      />
      <div style={{ marginTop: 40 }}>
        <DesktopUpdates config={config} />
      </div>
    </main>
  ) : surface === 'failed' ? (
    <DesktopState failed />
  ) : (
    <>
      <DesktopWelcome
        config={config}
        session={session}
        error={
          surface === 'error'
            ? 'Could not reach the calendar service. Check your connection and try again.'
            : null
        }
        startupFailed={false}
        onSignIn={idle}
        onCancel={idle}
        onRetry={idle}
      />
      {surface === 'offline' ? (
        <div className="desktop-connection">
          <DesktopNotice
            title="Connection interrupted"
            message="Reconnect to load your latest changes."
            onRetry={idle}
          />
        </div>
      ) : null}
    </>
  ),
)
