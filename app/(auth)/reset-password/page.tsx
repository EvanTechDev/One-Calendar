import { ResetPasswordForm } from '@/components/auth/reset-form'
import { AuthBrand } from '@/components/auth/auth-brand'
import { Suspense } from 'react'

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 relative overflow-hidden p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6 relative z-10">
        <AuthBrand />
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
