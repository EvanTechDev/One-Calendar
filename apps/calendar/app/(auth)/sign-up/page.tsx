import { SignUpForm } from '@zntr/auth/forms'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AuthFormHost } from '@/components/auth/auth-form-host'

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
