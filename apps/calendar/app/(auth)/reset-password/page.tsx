import { ResetPasswordForm } from '@zntr/auth/forms'
import { AuthFormHost } from '@/components/auth/auth-form-host'

/**
 * The reset token is read here and passed down, rather than the form calling
 * `useSearchParams()` itself: that hook has no meaning outside a Next app router,
 * and depending on it would make the shared component unusable in any other host
 * and untestable in jsdom (ADR 0022).
 *
 * Reading it server-side also removes the Suspense boundary the hook required.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const raw = params.token
  const token = Array.isArray(raw) ? raw[0] : raw

  return (
    <AuthFormHost>
      <ResetPasswordForm token={token ?? null} />
    </AuthFormHost>
  )
}
