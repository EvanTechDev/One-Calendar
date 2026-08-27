import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { RETURN_TO_PARAM } from '@/lib/auth/return-to'
import type { AuthSession } from '@zntr/auth'

/**
 * The session `/app` requires, or a redirect to sign-in.
 *
 * `/app` had no guard at all. The page read the session with
 * `authClient.useSession()` and rendered the calendar either way, so a signed-out
 * visitor kept the entire app shell and every refresh kept them there. Sign-out
 * called `router.refresh()`, which re-ran a page with nothing to gate on and so
 * changed nothing — the symptom being "signed out but still in the app".
 *
 * Server-side deliberately. A client-side redirect renders the shell first, which
 * is the same bug with better timing, and it leaks the shape of a signed-in page
 * to someone who is not.
 *
 * Fails CLOSED: an error reading the session redirects rather than continuing.
 * That is the opposite of the CAPTCHA check's posture, for the opposite reason —
 * there, failing open costs a bot defence; here, failing open costs access
 * control.
 */
export async function requireAppSession(
  returnTo?: string,
): Promise<AuthSession> {
  let session: AuthSession | null = null
  try {
    session = (await auth.api.getSession({
      headers: await headers(),
    })) as AuthSession | null
  } catch {
    session = null
  }

  // Checked for a user, not just a session: Better Auth can return a session
  // shape whose user is absent, and treating that as signed in is how a
  // half-valid cookie gets through.
  if (!session?.user) {
    const target = returnTo
      ? `/sign-in?${RETURN_TO_PARAM}=${encodeURIComponent(returnTo)}`
      : '/sign-in'
    redirect(target)
  }

  return session
}
