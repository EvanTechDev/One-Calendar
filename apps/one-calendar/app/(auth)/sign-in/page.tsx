import { LoginForm } from '@/components/auth/login-form'
import { AuthBrand } from '@/components/auth/auth-brand'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    redirect('/app')
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden p-6 md:p-10">
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
        <AuthBrand />
        <LoginForm />
      </div>
    </div>
  )
}
