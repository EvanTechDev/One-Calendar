'use client'

import { Turnstile } from '@marsidev/react-turnstile'
import { GalleryVerticalEnd } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { authClient } from '@/lib/auth/client'
import { cn } from '@/lib/utils'

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  })
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [isCaptchaCompleted, setIsCaptchaCompleted] = useState(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? false : true,
  )

  const sendVerificationOtp = async (withResendLoading: boolean) => {
    if (withResendLoading) setIsResending(true)
    const otpRes = await authClient.emailOtp.sendVerificationOtp({
      email: formData.email,
      type: 'email-verification',
    })
    if (withResendLoading) setIsResending(false)
    if (otpRes.error) {
      setError(otpRes.error.message || 'Failed to send verification code.')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !isCaptchaCompleted) {
      setError('Please complete the CAPTCHA verification.')
      return
    }

    setIsLoading(true)
    setError('')

    const signUpRes = await authClient.signUp.email({
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      email: formData.email,
      password: formData.password,
      callbackURL: '/app',
    })

    if (signUpRes.error) {
      setError(
        signUpRes.error.message || 'An error occurred. Please try again.',
      )
      setIsLoading(false)
      return
    }

    const sentOk = await sendVerificationOtp(false)
    if (sentOk) setSent(true)
    setIsLoading(false)
  }

  const verifyOtp = async () => {
    if (!otp.trim()) return
    setIsVerifying(true)
    setError('')
    const verifyRes = await authClient.emailOtp.verifyEmail({
      email: formData.email,
      otp: otp.trim(),
    })
    if (verifyRes.error) {
      setError(
        verifyRes.error.message ||
          'Invalid verification code. Please try again.',
      )
      setIsVerifying(false)
      return
    }
    router.push('/sign-in')
    router.refresh()
  }

  const handleResend = async () => {
    if (isResending || isLoading || isVerifying) return
    setError('')
    await sendVerificationOtp(true)
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={sent ? (e) => e.preventDefault() : handleSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a href="/" className="flex flex-col items-center gap-2 font-medium">
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEnd className="size-6" />
              </div>
              <span className="sr-only">One Calendar</span>
            </a>
            <h1 className="text-xl font-bold">Create your account</h1>
            <FieldDescription>
              {sent
                ? `Verification code sent to ${formData.email}`
                : 'Sign up with your email and password'}
            </FieldDescription>
          </div>

          {sent ? (
            <div className="grid gap-6">
              <div className="rounded-lg border p-4">
                <div className="text-sm font-medium">Step 2 of 2</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  A verification code has been sent to{' '}
                  <span className="font-medium text-foreground">
                    {formData.email}
                  </span>
                  . Enter the code below to activate your account.
                </div>
              </div>
              <Field>
                <FieldLabel htmlFor="otp">Verification code</FieldLabel>
                <InputOTP
                  value={otp}
                  onChange={(value) =>
                    setOtp(value.replace(/\D/g, '').slice(0, 6))
                  }
                  maxLength={6}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </Field>
              {error && <div className="text-sm text-red-500">{error}</div>}
              <Field>
                <Button
                  type="button"
                  className="w-full bg-[#0066ff] text-white hover:bg-[#0047cc]"
                  onClick={verifyOtp}
                  disabled={isVerifying || isResending || otp.length < 6}
                >
                  {isVerifying ? 'Verifying...' : 'Verify code'}
                </Button>
              </Field>
              <Field>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResend}
                  disabled={isResending || isVerifying}
                >
                  {isResending ? 'Resending...' : 'Resend code'}
                </Button>
              </Field>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="firstName">First name</FieldLabel>
                  <Input
                    id="firstName"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                  <Input
                    id="lastName"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </Field>
              {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                <Turnstile
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                  options={{ size: 'flexible' }}
                  onSuccess={() => setIsCaptchaCompleted(true)}
                  onExpire={() => setIsCaptchaCompleted(false)}
                  onError={() => {
                    setIsCaptchaCompleted(false)
                    setError('CAPTCHA initialization failed. Please try again.')
                  }}
                />
              )}
              {error && <div className="text-sm text-red-500">{error}</div>}
              <Field>
                <Button
                  type="submit"
                  className="w-full bg-[#0066ff] text-white hover:bg-[#0047cc]"
                  disabled={isLoading || !isCaptchaCompleted}
                >
                  {isLoading ? 'Creating account...' : 'Sign up'}
                </Button>
              </Field>
              <FieldDescription className="text-center text-sm">
                Already have an account?{' '}
                <a href="/sign-in" className="underline underline-offset-4">
                  Sign in
                </a>
              </FieldDescription>
            </>
          )}
        </FieldGroup>
      </form>

      <FieldDescription className="px-6 text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        By clicking continue, you agree to our{' '}
        <a href="/terms">Terms of Service</a> and{' '}
        <a href="/privacy">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}

