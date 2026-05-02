'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type React from 'react'

export function ResetPasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    const { error } = await authClient.forgetPassword({ email, redirectTo: '/sign-in' } as any)
    if (error) setError(error.message || 'An error occurred. Please try again.')
    else setDone(true)
    setIsLoading(false)
  }

  return <div className={cn('flex flex-col gap-6', className)} {...props}><Card><CardHeader className="text-center"><CardTitle className="text-xl">Reset your password</CardTitle><CardDescription>{done ? 'Reset email sent. Please check your inbox.' : "Enter your email and we'll send a reset link"}</CardDescription></CardHeader><CardContent><form onSubmit={handleSubmit}><div className="grid gap-6"><div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>{error && <div className="text-sm text-red-500">{error}</div>}<Button type="submit" className="w-full bg-[#0066ff] hover:bg-[#0047cc] text-white" disabled={isLoading}>{isLoading ? 'Sending...' : 'Send reset email'}</Button></div></form></CardContent></Card></div>
}
