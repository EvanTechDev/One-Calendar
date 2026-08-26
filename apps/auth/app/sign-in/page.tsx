import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { RETURN_TO_PARAM, resolvePortalReturnTo } from '@zntr/auth/return-to'
import { LoginForm } from '@/components/auth/login-form'
import { registeredClientOrigins } from '@/lib/client-origins'
import { getPortal } from '@/lib/auth'

/**
 * Sign-in. The only one in the suite (ADR 0021).
 *
 * The return URL is resolved **here**, on the server, against the origins of
 * registered clients — never passed through to the form from the query string.
 * A form that trusted the raw parameter would bounce a browser holding a fresh
 * session cookie wherever an attacker asked.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const requested = params[RETURN_TO_PARAM]
  const returnTo = resolvePortalReturnTo(
    typeof requested === 'string' ? requested : null,
    await registeredClientOrigins(),
  )

  // Already signed in: send them on rather than showing a form they do not need.
  // This is also what makes the OAuth flow feel like single sign-on — the second
  // app's authorize request finds a session and never renders this page.
  const session = await getPortal().auth.api.getSession({
    headers: await headers(),
  })
  if (session) redirect(returnTo)

  return <LoginForm returnTo={returnTo} />
}
