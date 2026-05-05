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

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false)
  const [error, setError] = useState('')
  const [isCaptchaCompleted, setIsCaptchaCompleted] = useState(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? false : true)
  const router = useRouter()

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !isCaptchaCompleted) return setError('Please complete the CAPTCHA verification.')
    setIsLoading(true)
    setError('')

    const res = await authClient.signIn.email({ email, password })
    if (res.error) {
      const message = res.error.message || ''
      if (message.toLowerCase().includes('two-factor') || message.toLowerCase().includes('totp')) {
        setNeedsTwoFactor(true)
      } else {
        setError(message || 'Login failed. Please try again.')
      }
      setIsLoading(false)
      return
    }

    if ((res as any).data?.twoFactorRedirect || (res as any).data?.requiresTwoFactor) {
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
    const res = await authClient.twoFactor.verifyTotp({ code: totp, trustDevice: true })
    if (res.error) {
      setError(res.error.message || 'Invalid verification code.')
      setIsVerifyingTotp(false)
      return
    }
    router.push('/app')
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            {needsTwoFactor ? 'Enter your authenticator app code' : 'Login with your email and password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {needsTwoFactor ? (
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label>Two-factor code</Label>
                <InputOTP value={totp} onChange={(value) => setTotp(value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
              </div>
              {error && <div className="text-sm text-red-500">{error}</div>}
              <Button className="w-full bg-[#0066ff] text-white hover:bg-[#0047cc]" onClick={handleVerifyTotp} disabled={isVerifyingTotp || totp.length < 6}>
                {isVerifyingTotp ? 'Verifying...' : 'Verify and sign in'}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleEmailLogin}>
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                    <a href="/reset-password" className="ml-auto text-sm underline-offset-4 hover:underline">
                      Forgot your password?
                    </a>
                  </div>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
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
                <Button type="submit" className="w-full bg-[#0066ff] text-white hover:bg-[#0047cc]" disabled={isLoading || !isCaptchaCompleted}>
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
                <div className="text-center text-sm">
                  Don't have an account?{' '}
                  <a href="/sign-up" className="underline underline-offset-4">
                    Sign up
                  </a>
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

        <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
          By clicking continue, you agree to our{' '}
          <a href="/terms">Terms of Service</a> and{' '}
          <a href="/privacy">Privacy Policy</a>.
        </div>
    </div>
  )
}
