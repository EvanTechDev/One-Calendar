import { LoginForm } from '@/components/auth/login-form'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    redirect('/app')
  }

  return <LoginForm />
}
