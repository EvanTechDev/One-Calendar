import { createReturnToResolver, RETURN_TO_PARAM } from '@zntr/auth/return-to'

/**
 * This app's return-to allowlist.
 *
 * Meet had none of this while it had no sign-in page. It has one now, so it has
 * the same open-redirect surface the calendar always had — and gets the same
 * hardened resolver rather than a fresh copy (ADR 0022).
 */
export { RETURN_TO_PARAM }

/** Where signed-in users land with no return request: the dashboard. */
export const DEFAULT_SIGNED_IN_PATH = '/'

export const resolveReturnTo = createReturnToResolver({
  defaultPath: DEFAULT_SIGNED_IN_PATH,
  siblingOrigins: () => [process.env.NEXT_PUBLIC_CALENDAR_ORIGIN],
})
