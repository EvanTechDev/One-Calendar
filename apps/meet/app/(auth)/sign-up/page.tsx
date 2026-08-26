import { SignUpForm } from '@zntr/auth/forms'
import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import { AuthFormHost } from '@/components/auth/auth-form-host'

export default async function SignUpPage() {
  const session = await getServerSession()
  if (session?.user) redirect('/')

  return (
    <AuthFormHost>
      <SignUpForm />
    </AuthFormHost>
  )
}
