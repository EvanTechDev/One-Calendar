'use client'

import { Turnstile } from '@marsidev/react-turnstile'
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
import Image from 'next/image'

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false)
  const [error, setError] = useState('')
  const [isCaptchaCompleted, setIsCaptchaCompleted] = useState(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? false : true,
  )
  const router = useRouter()

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !isCaptchaCompleted)
      return setError('Please complete the CAPTCHA verification.')
    setIsLoading(true)
    setError('')

    const res = await authClient.signIn.email({ email, password })
    if (res.error) {
      const message = res.error.message || ''
      if (
        message.toLowerCase().includes('two-factor') ||
        message.toLowerCase().includes('totp')
      ) {
        setNeedsTwoFactor(true)
      } else {
        setError(message || 'Login failed. Please try again.')
      }
      setIsLoading(false)
      return
    }

    if (
      (res as any).data?.twoFactorRedirect ||
      (res as any).data?.requiresTwoFactor
    ) {
      setNeedsTwoFactor(true)
      setIsLoading(false)
      return
    }

    router.push('/app')
    setIsLoading(false)
  }

  const handleVerifyTotp = async () => {
    if (totp.length < 6) return
    setIsVerifyingTotp(true)
    setError('')
    const res = await authClient.twoFactor.verifyTotp({
      code: totp,
      trustDevice: true,
    })
    if (res.error) {
      setError(res.error.message || 'Invalid verification code.')
      setIsVerifyingTotp(false)
      return
    }
    router.push('/app')
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={handleEmailLogin}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a href="/" className="flex flex-col items-center gap-2 font-medium">
              <div className="flex size-8 items-center justify-center rounded-md">
                <Image
                  src="/icon.svg"
                  alt="One Calendar"
                  width={16}
                  height={16}
                  className="size-6"
                />
              </div>
              <span className="sr-only">One Calendar</span>
            </a>
            <h1 className="text-xl font-bold">Welcome back</h1>
            <FieldDescription>
              {needsTwoFactor ? (
                'Enter your authenticator app code'
              ) : (
                <>
                  Don&apos;t have an account?{' '}
                  <a href="/sign-up" className="underline underline-offset-4">
                    Sign up
                  </a>
                </>
              )}
            </FieldDescription>
          </div>

          {needsTwoFactor ? (
            <div className="grid gap-6">
              <Field>
                <FieldLabel>Two-factor code</FieldLabel>
                <InputOTP
                  value={totp}
                  onChange={(value) =>
                    setTotp(value.replace(/\D/g, '').slice(0, 6))
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
                  className="w-full bg-[#0066ff] text-white hover:bg-[#0047cc]"
                  onClick={handleVerifyTotp}
                  disabled={isVerifyingTotp || totp.length < 6}
                >
                  {isVerifyingTotp ? 'Verifying...' : 'Verify and sign in'}
                </Button>
              </Field>
            </div>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="/reset-password"
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
              </Field>
              <FieldDescription className="text-center text-sm">
                Login with your email and password
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

