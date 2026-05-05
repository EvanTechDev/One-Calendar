'use client'

import { Turnstile } from '@marsidev/react-turnstile'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import type React from 'react'

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
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [notice, setNotice] = useState('')
  const [isCaptchaCompleted, setIsCaptchaCompleted] = useState(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? false : true,
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !isCaptchaCompleted)
      return setError('Please complete the CAPTCHA verification.')
    setIsLoading(true)
    setError('')
    setNotice('')
    const res = await authClient.forgetPassword({
      email,
      redirectTo: '/reset-password',
    } as never)
    if (!res.error) {
      setDone(true)
      setNotice('Reset email sent. Please check your inbox.')
      setIsLoading(false)
      return
    }
    const fallbackBody = JSON.stringify({
      email,
      redirectTo: '/reset-password',
    })
    const fallbackEndpoints = [
      '/api/auth/forget-password',
      '/api/auth/forgot-password',
      '/api/auth/request-password-reset',
    ]
    let fallbackSucceeded = false
    for (const endpoint of fallbackEndpoints) {
      try {
        const fallback = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: fallbackBody,
        })
        if (fallback.ok) {
          fallbackSucceeded = true
          break
        }
      } catch {}
    }
    if (fallbackSucceeded) {
      setDone(true)
      setNotice('Reset email sent. Please check your inbox.')
    } else setError(res.error.message || 'An error occurred. Please try again.')
    setIsLoading(false)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !isCaptchaCompleted)
      return setError('Please complete the CAPTCHA verification.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setIsLoading(true)
    setError('')
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    } as never)
    if (error)
      setError(error.message || 'Failed to reset password. Please try again.')
    else setDone(true)
    setIsLoading(false)
  }

  const isTokenFlow = Boolean(token)

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>
            {isTokenFlow
              ? done
                ? 'Password updated successfully. You can sign in now.'
                : 'Enter your new password to complete reset.'
              : done
                ? 'Reset email sent. Please check your inbox.'
                : "Enter your email and we'll send a reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isTokenFlow ? handleResetPassword : handleSubmit}>
            <div className="grid gap-6">
              {isTokenFlow ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}
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
              {!isTokenFlow && notice ? (
                <div className="text-sm text-emerald-600">{notice}</div>
              ) : null}
              {error && <div className="text-sm text-red-500">{error}</div>}
              <Button
                type="submit"
                className="w-full bg-[#0066ff] text-white hover:bg-[#0047cc]"
                disabled={isLoading || !isCaptchaCompleted}
              >
                {isLoading
                  ? isTokenFlow
                    ? 'Updating...'
                    : 'Sending...'
                  : isTokenFlow
                    ? 'Update password'
                    : 'Send reset email'}
              </Button>
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
