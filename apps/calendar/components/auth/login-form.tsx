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

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [revealPassword, setRevealPassword] = useState(false)
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
    <AuthLayout
      title={needsTwoFactor ? 'Two-factor authentication' : 'Welcome back'}
      description={
        needsTwoFactor
          ? 'Enter your authenticator app code'
          : 'Sign in to your account to continue.'
      }
      _showOAuth={!needsTwoFactor}
      _showMagicLink={!needsTwoFactor}
      footer={
        needsTwoFactor ? undefined : (
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <p className="whitespace-nowrap text-muted-foreground">
              Don&apos;t have an account?{' '}
              <a href="/sign-up" className="text-primary underline">
                Sign up
              </a>
            </p>
            <a href="/reset-password" className="text-primary underline">
              Forgot password?
            </a>
          </div>
        )
      }
    >
      {needsTwoFactor ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label>Two-factor code</Label>
            <InputOTP
              value={totp}
              onChange={(value) =>
                setTotp(value.replace(/\D/g, '').slice(0, 6))
              }
              maxLength={6}
            />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          <Button
            className="w-full"
            onClick={handleVerifyTotp}
            disabled={isVerifyingTotp || totp.length < 6}
            size="lg"
          >
            {isVerifyingTotp ? 'Verifying...' : 'Verify and sign in'}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="Enter your email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
