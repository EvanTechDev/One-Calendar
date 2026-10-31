import type { DesktopAuthOptions } from '@zntr/auth/types'

export function desktopAuthConfig(baseURL?: string): DesktopAuthOptions {
  const origin = new URL(baseURL ?? 'http://localhost:3000').origin
  const environment =
    process.env.ZENTRA_DESKTOP_ENV ??
    (new URL(origin).hostname === 'precal.xyehr.cn' ? 'dev' : 'production')
  if (environment !== 'dev' && environment !== 'production') {
    throw new Error('ZENTRA_DESKTOP_ENV must be dev or production')
  }
  const dev = environment === 'dev'
  return {
    clientId: dev ? 'zentra-desktop-dev' : 'zentra-desktop',
    redirectUri: `${dev ? 'app.zntr.calendar.dev' : 'app.zntr.calendar'}:/oauth/callback`,
    resource: `${origin}/api/desktop`,
  }
}
