import { LoginForm } from '@zntr/auth/forms'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { RETURN_TO_PARAM, resolveReturnTo } from '@/lib/auth/return-to'
import { AuthFormHost } from '@/components/auth/auth-form-host'

/**
 * Zentra Meet links here to sign a user in and expects them back, so this page
 * honours a return URL. The destination is resolved against an allowlist
 * server-side (see lib/auth/return-to) — accepting it verbatim would make this
 * an open redirect off a freshly-authenticated session.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const raw = params[RETURN_TO_PARAM]
  const requested = Array.isArray(raw) ? raw[0] : raw
  const returnTo = resolveReturnTo(requested)

  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    redirect(returnTo)
  }

  return (
    <AuthFormHost>
      <LoginForm returnTo={returnTo} />
    </AuthFormHost>
  )
}
