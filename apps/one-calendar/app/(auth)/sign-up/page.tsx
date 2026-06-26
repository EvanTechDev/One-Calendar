import { SignUpForm } from '@/components/auth/sign-up-form'
import { AuthBrand } from '@/components/auth/auth-brand'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    redirect('/app')
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center relative overflow-hidden gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6 relative z-10">
        <AuthBrand />
        <SignUpForm />
      </div>
    </div>
  )
}
