'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type React from 'react'
import { useSearchParams } from 'next/navigation'
import { Turnstile } from '@marsidev/react-turnstile'

export function ResetPasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [isCaptchaCompleted, setIsCaptchaCompleted] = useState(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? false : true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !isCaptchaCompleted) return setError('Please complete the CAPTCHA verification.')
    setIsLoading(true)
    setError('')
    const { error } = await authClient.forgetPassword({ email, callbackURL: '/reset-password', redirectTo: '/reset-password' } as never)
    if (error) setError(error.message || 'An error occurred. Please try again.')
    else setDone(true)
    setIsLoading(false)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !isCaptchaCompleted) return setError('Please complete the CAPTCHA verification.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setIsLoading(true)
    setError('')
    const { error } = await authClient.resetPassword({ newPassword: password, token } as never)
    if (error) setError(error.message || 'Failed to reset password. Please try again.')
    else setDone(true)
    setIsLoading(false)
  }

  const isTokenFlow = Boolean(token)

  return <div className={cn('flex flex-col gap-6', className)} {...props}><Card><CardHeader className="text-center"><CardTitle className="text-xl">Reset your password</CardTitle><CardDescription>{isTokenFlow ? (done ? 'Password updated successfully. You can sign in now.' : 'Enter your new password to complete reset.') : (done ? 'Reset email sent. Please check your inbox.' : "Enter your email and we'll send a reset link")}</CardDescription></CardHeader><CardContent><form onSubmit={isTokenFlow ? handleResetPassword : handleSubmit}><div className="grid gap-6">{isTokenFlow ? (<><div className="grid gap-2"><Label htmlFor="password">New password</Label><Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div><div className="grid gap-2"><Label htmlFor="confirmPassword">Confirm password</Label><Input id="confirmPassword" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div></>) : (<div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>)}{process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} options={{ size: 'flexible' }} onSuccess={() => setIsCaptchaCompleted(true)} onExpire={() => setIsCaptchaCompleted(false)} onError={() => { setIsCaptchaCompleted(false); setError('CAPTCHA initialization failed. Please try again.') }} />} {error && <div className="text-sm text-red-500">{error}</div>}<Button type="submit" className="w-full bg-[#0066ff] hover:bg-[#0047cc] text-white" disabled={isLoading || !isCaptchaCompleted}>{isLoading ? (isTokenFlow ? 'Updating...' : 'Sending...') : (isTokenFlow ? 'Update password' : 'Send reset email')}</Button></div></form></CardContent></Card></div>
}
