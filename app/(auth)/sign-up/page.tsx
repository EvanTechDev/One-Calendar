import { SignUpForm } from '@/components/auth/sign-up-form'
import { AuthBrand } from '@/components/auth/auth-brand'

export default function SignUpPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-white dark:bg-black">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />
        </div>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm">
        <AuthBrand />
        <SignUpForm />
      </div>
    </div>
  )
}
