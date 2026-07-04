'use client'

import { Turnstile } from '@marsidev/react-turnstile'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'

import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { InputOTP } from '@zntr/ui/input-otp'
import { Label } from '@zntr/ui/label'
import { authClient } from '@/lib/auth/client'
import { AuthLayout } from './auth-layout'

export function SignUpForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  })
  const [revealPassword, setRevealPassword] = useState(false)
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
    <AuthLayout
      title={sent ? 'Verify your email' : 'Create your account'}
      description={
        sent
          ? `Verification code sent to ${formData.email}`
          : 'Sign up with your email and password'
      }
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <a href="/sign-in" className="text-primary underline">
            Sign in
          </a>
        </p>
      }
    >
      {sent ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="otp">Verification code</Label>
            <InputOTP
              value={otp}
              onChange={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
            />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          <Button
            type="button"
            className="w-full"
            onClick={verifyOtp}
            disabled={isVerifying || isResending || otp.length < 6}
            size="lg"
          >
            {isVerifying ? 'Verifying...' : 'Verify code'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={isResending || isVerifying}
            size="lg"
          >
            {isResending ? 'Resending...' : 'Resend code'}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                required
                placeholder="First name"
                autoComplete="given-name"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                required
                placeholder="Last name"
                autoComplete="family-name"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="Enter your email"
              autoComplete="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={revealPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setRevealPassword((value) => !value)}
                aria-label={revealPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {revealPassword ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </button>
            </div>
          </div>
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
          <Button
            type="submit"
            size="lg"
            disabled={isLoading || !isCaptchaCompleted}
            className="mt-2"
          >
            {isLoading ? 'Creating account...' : 'Sign up'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
