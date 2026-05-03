'use client'

import { Turnstile } from '@marsidev/react-turnstile'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { InputOTP } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const router = useRouter()
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [isCaptchaCompleted, setIsCaptchaCompleted] = useState(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? false : true)

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
      setError(signUpRes.error.message || 'An error occurred. Please try again.')
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
    const verifyRes = await authClient.emailOtp.verifyEmail({ email: formData.email, otp: otp.trim() })
    if (verifyRes.error) {
      setError(verifyRes.error.message || 'Invalid verification code. Please try again.')
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
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            {sent ? `Verification code sent to ${formData.email}` : 'Sign up with your email and password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="grid gap-6">
              <div className="rounded-lg border p-4">
                <div className="text-sm font-medium">Step 2 of 2</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  A verification code has been sent to{' '}
                  <span className="font-medium text-foreground">{formData.email}</span>. Enter the code below to activate your account.
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="otp">Verification code</Label>
                <InputOTP value={otp} onChange={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
              </div>
              {error && <div className="text-sm text-red-500">{error}</div>}
              <Button
                type="button"
                className="w-full bg-[#0066ff] text-white hover:bg-[#0047cc]"
                onClick={verifyOtp}
                disabled={isVerifying || isResending || otp.length < 6}
              >
                {isVerifying ? 'Verifying...' : 'Verify code'}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={handleResend} disabled={isResending || isVerifying}>
                {isResending ? 'Resending...' : 'Resend code'}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
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
                  className="w-full bg-[#0066ff] text-white hover:bg-[#0047cc]"
                  disabled={isLoading || !isCaptchaCompleted}
                >
                  {isLoading ? 'Creating account...' : 'Sign up'}
                </Button>
                <div className="text-center text-sm">
                  Already have an account?{' '}
                  <a href="/sign-in" className="underline underline-offset-4">
                    Sign in
                  </a>
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
