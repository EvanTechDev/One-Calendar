import { createReturnToResolver, RETURN_TO_PARAM } from '@zntr/auth/return-to'

/**
 * This app's return-to allowlist.
 *
 * The resolver moved to @zntr/auth when meet gained its own sign-in page: both
 * apps link to the other and expect the user back, so both are open-redirect
 * surfaces and both need the identical guard (ADR 0022).
 */
export { RETURN_TO_PARAM }

/** Where signed-in users land with no return request. */
export const DEFAULT_SIGNED_IN_PATH = '/app'

export const resolveReturnTo = createReturnToResolver({
  defaultPath: DEFAULT_SIGNED_IN_PATH,
  siblingOrigins: () => [process.env.NEXT_PUBLIC_MEET_ORIGIN],
})
