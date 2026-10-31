import { SignUpForm } from '@zntr/auth/forms'
import { headers } from 'next/headers'
import { auth } from '@/features/auth'
import { redirect } from 'next/navigation'
import { AuthFormHost } from '@/features/auth/components/auth-form-host'

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    redirect('/app')
  }

  return (
    <AuthFormHost>
      <SignUpForm />
    </AuthFormHost>
  )
}
