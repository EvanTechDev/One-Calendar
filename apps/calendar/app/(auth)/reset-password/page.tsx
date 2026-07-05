import { ResetPasswordForm } from '@/components/auth/reset-form'
import { Suspense } from 'react'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
