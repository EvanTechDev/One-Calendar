'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSignIn } from '@clerk/nextjs'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Turnstile } from '@marsidev/react-turnstile'
import {
  getEnabledOAuthProviderKeys,
  OAUTH_PROVIDER_CONFIG,
  type OAuthStrategy,
} from '@/lib/clerk-oauth'
import { OAuthProviderIcon } from '@/components/auth/oauth-provider-icon'

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const { signIn } = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCaptchaCompleted, setIsCaptchaCompleted] = useState(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? false : true,
  )
  const turnstileRef = useRef<any>(null)
  const router = useRouter()

  const handleTurnstileSuccess = async (token: string) => {
    console.log('Turnstile token received:', token.slice(0, 10) + '...')
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'login' }),
      })
      const data = await response.json()
      console.log('Verification API response:', JSON.stringify(data, null, 2))

      if (data.success) {
        setIsCaptchaCompleted(true)
        setError('')
      } else {
        setIsCaptchaCompleted(false)
        setError(
          `CAPTCHA verification failed: ${data.details?.join(', ') || 'Unknown error'}`,
        )
        if (turnstileRef.current) {
          turnstileRef.current.reset()
        }
      }
    } catch (err) {
      console.error('Error in handleTurnstileSuccess:', err)
      setIsCaptchaCompleted(false)
      setError('Error verifying CAPTCHA. Please try again.')
      if (turnstileRef.current) {
        turnstileRef.current.reset()
      }
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (siteKey && !isCaptchaCompleted) {
      setError('Please complete the CAPTCHA verification.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const { error } = await signIn.password({
        emailAddress: email,
        password,
      })
      if (error) {
        setError(
          error.longMessage ||
            error.message ||
            'Login failed. Please try again.',
        )
        return
      }

      if (signIn.status === 'complete') {
        const { error: finalizeError } = await signIn.finalize({
          navigate: ({ decorateUrl }) => {
            const url = decorateUrl('/app')
            if (url.startsWith('http')) {
              window.location.href = url
              return
            }
            router.push(url)
          },
        })
        if (finalizeError) {
          setError(
            finalizeError.longMessage ||
              finalizeError.message ||
              'Login failed. Please try again.',
          )
        }
      }
    } catch (err: any) {
      setError(
        err.errors?.[0]?.longMessage || 'Login failed. Please try again.',
      )
      if (siteKey) {
        setIsCaptchaCompleted(false)
        if (turnstileRef.current) {
          turnstileRef.current.reset()
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthLogin = (strategy: OAuthStrategy) => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (siteKey && !isCaptchaCompleted) {
      setError('Please complete the CAPTCHA verification.')
      return
    }
    signIn.sso({
      strategy,
      redirectUrl: '/app',
      redirectCallbackUrl: '/sign-in/sso-callback',
    })
  }

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const hasCaptcha = Boolean(siteKey)
  const enabledOAuthProviders = getEnabledOAuthProviderKeys()
  const hasOAuthProviders = enabledOAuthProviders.length > 0

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            {hasOAuthProviders
              ? 'Login with your OAuth provider account'
              : 'Login with your email and password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailLogin}>
            <div className="grid gap-6">
              {hasOAuthProviders && (
                <>
                  <div className="flex flex-col gap-4">
                    {enabledOAuthProviders.map((providerKey) => {
                      const provider = OAUTH_PROVIDER_CONFIG[providerKey]
                      return (
                        <Button
                          key={provider.strategy}
                          variant="outline"
                          className="w-full"
                          type="button"
                          onClick={() => handleOAuthLogin(provider.strategy)}
                        >
                          <span className="flex items-center justify-center gap-2">
                            <OAuthProviderIcon providerKey={providerKey} />
                            <span>Login with {provider.label}</span>
                          </span>
                        </Button>
                      )
                    })}
                  </div>
                  <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                    <span className="relative z-10 bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </>
              )}
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
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
                </div>
                {hasCaptcha && (
                  <div className="turnstile-container">
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={siteKey!}
                      onSuccess={handleTurnstileSuccess}
                      onError={() => {
                        console.error('Turnstile widget error')
                        setIsCaptchaCompleted(false)
                        setError(
                          'CAPTCHA initialization failed. Please try again.',
                        )
                      }}
                      options={{
                        theme: 'auto',
                        action: 'login',
                        cData: 'login-page',
                        refreshExpired: 'auto',
                        size: 'flexible',
                      }}
                    />
                  </div>
                )}
                {error && <div className="text-sm text-red-500">{error}</div>}
                <Button
                  type="submit"
                  className="w-full bg-[#0066ff] hover:bg-[#0047cc] text-white"
                  disabled={
                    hasCaptcha ? !isCaptchaCompleted || isLoading : isLoading
                  }
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
              </div>
              <div className="text-center text-sm">
                Don't have an account?{' '}
                <a href="/sign-up" className="underline underline-offset-4">
                  Sign up
                </a>
              </div>
            </div>
          </form>
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
