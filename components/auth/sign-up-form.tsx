'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const router = useRouter()
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [isCaptchaCompleted, setIsCaptchaCompleted] = useState(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? false : true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !isCaptchaCompleted) return setError('Please complete the CAPTCHA verification.')
    setIsLoading(true)
    setError('')
    const { error } = await authClient.signUp.email({
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      email: formData.email,
      password: formData.password,
      callbackURL: '/app',
    })
    if (error) setError(error.message || 'An error occurred. Please try again.')
    else setSent(true)
    setIsLoading(false)
  }

  return <div className={cn('flex flex-col gap-6', className)} {...props}><Card><CardHeader className="text-center"><CardTitle className="text-xl">Create your account</CardTitle><CardDescription>{sent ? `Verification email sent to ${formData.email}` : 'Sign up with your email and password'}</CardDescription></CardHeader><CardContent><form onSubmit={handleSubmit}><div className="grid gap-6"><div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label htmlFor="firstName">First name</Label><Input id="firstName" name="firstName" required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} /></div><div className="grid gap-2"><Label htmlFor="lastName">Last name</Label><Input id="lastName" name="lastName" required value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} /></div></div><div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div><div className="grid gap-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} /></div>{process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} options={{ size: 'flexible' }} onSuccess={() => setIsCaptchaCompleted(true)} onExpire={() => setIsCaptchaCompleted(false)} onError={() => { setIsCaptchaCompleted(false); setError('CAPTCHA initialization failed. Please try again.') }} />} {error && <div className="text-sm text-red-500">{error}</div>}<Button type="submit" className="w-full bg-[#0066ff] hover:bg-[#0047cc] text-white" disabled={isLoading || !isCaptchaCompleted}>{isLoading ? 'Creating account...' : 'Sign up'}</Button><div className="text-center text-sm">Already have an account? <a href="/sign-in" className="underline underline-offset-4">Sign in</a></div>{sent && <Button type="button" variant="outline" className="w-full" onClick={() => router.push('/sign-in')}>Go to sign in</Button>}</div></form></CardContent></Card></div>
}
