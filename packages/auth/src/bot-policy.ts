/** Browser credential and mail-sending endpoints, shared by both auth hosts. */
const guardedPaths = [
  'sign-in/email',
  'sign-up/email',
  'forget-password',
  'request-password-reset',
  'email-otp/request-password-reset',
  'email-otp/send-verification-otp',
]

// Client and server must use the same level. Basic does not opt into paid Deep Analysis.
export const BOT_ID_OPTIONS = { checkLevel: 'basic' as const }

/** Captcha plugin `endpoints`: paths without the Better Auth base path. */
export const BOT_ID_ENDPOINTS = guardedPaths.map((path) => `/${path}`)

/** `initBotId` routes: the browser's full request paths. */
export const BOT_ID_ROUTES = guardedPaths.map((path) => ({
  path: `/api/auth/${path}`,
  method: 'POST',
  advancedOptions: BOT_ID_OPTIONS,
}))

export function botIdIsGuarded(method: string, path: string): boolean {
  return method.toUpperCase() === 'POST' && guardedPaths.includes(path)
}

// BotID 1.5.11's same-origin rewrite namespace. The SDK owns its framing headers;
// the Calendar page CSP must not replace them with frame-ancestors 'none'.
export const BOT_ID_PROXY_PREFIX =
  '/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/'
