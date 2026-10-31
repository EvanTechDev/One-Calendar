import { ResetPasswordForm } from '@zntr/auth/forms'
import { AuthFormHost } from '@/components/auth/auth-form-host'

/**
 * The token is read here and passed down rather than the form reading it with
 * `useSearchParams()`: that hook ties a component to a Next app router, which is
 * the opposite of what a shared component needs (ADR 0022).
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
