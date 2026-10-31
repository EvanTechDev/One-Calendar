import { LoginForm } from '@zntr/auth/forms'
import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import { AuthFormHost } from '@/components/auth/auth-form-host'
import { resolveReturnTo, RETURN_TO_PARAM } from '@/lib/auth/return-to'

/**
 * Meet's own sign-in.
 *
 * It used to have none: the only way in was a link to the calendar. The session is
 * shared by cookie either way (see @zntr/auth's crossAppAuthConfig), so this is
 * about not making a user leave the app they opened (ADR 0022).
 *
 * The return URL is resolved against an allowlist server-side — taking it verbatim
 * would make this an open redirect off a freshly-authenticated session.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const raw = params[RETURN_TO_PARAM]
  const requested = Array.isArray(raw) ? raw[0] : raw
  const returnTo = resolveReturnTo(requested)

  const session = await getServerSession()
  if (session?.user) redirect(returnTo)

  return (
    <AuthFormHost>
      <LoginForm returnTo={returnTo} />
    </AuthFormHost>
  )
}
