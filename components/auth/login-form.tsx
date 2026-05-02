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
import { authClient } from '@/lib/auth-client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Turnstile } from '@marsidev/react-turnstile'

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCaptchaCompleted, setIsCaptchaCompleted] = useState(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? false : true)
  const turnstileRef = useRef<any>(null)
  const router = useRouter()

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !isCaptchaCompleted) return setError('Please complete the CAPTCHA verification.')
    setIsLoading(true)
    setError('')
    const { error } = await authClient.signIn.email({ email, password })
    if (error) setError(error.message || 'Login failed. Please try again.')
    else router.push('/app')
    setIsLoading(false)
  }

  return <div className={cn('flex flex-col gap-6', className)} {...props}><Card><CardHeader className="text-center"><CardTitle className="text-xl">Welcome back</CardTitle><CardDescription>Login with your email and password</CardDescription></CardHeader><CardContent><form onSubmit={handleEmailLogin}><div className="grid gap-6"><div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} /></div><div className="grid gap-2"><div className="flex items-center"><Label htmlFor="password">Password</Label><a href="/reset-password" className="ml-auto text-sm underline-offset-4 hover:underline">Forgot your password?</a></div><Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>{process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && <Turnstile ref={turnstileRef} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} options={{ size: 'flexible' }} onSuccess={() => setIsCaptchaCompleted(true)} onExpire={() => setIsCaptchaCompleted(false)} onError={() => { setIsCaptchaCompleted(false); setError('CAPTCHA initialization failed. Please try again.') }} />} {error && <div className="text-sm text-red-500">{error}</div>}<Button type="submit" className="w-full bg-[#0066ff] hover:bg-[#0047cc] text-white" disabled={isLoading || !isCaptchaCompleted}>{isLoading ? 'Signing in...' : 'Sign in'}</Button><div className="text-center text-sm">Don't have an account? <a href="/sign-up" className="underline underline-offset-4">Sign up</a></div></div></form></CardContent></Card></div>
}
