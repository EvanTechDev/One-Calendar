import { SignUpForm } from '@/components/auth/sign-up-form'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    redirect('/app')
  }

  return <SignUpForm />
}
