'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCryptoContext } from '@/lib/crypto-context'

export function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { register } = useCryptoContext()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await register(email, password)
      window.location.href = '/app'
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
      <Button type="submit" disabled={submitting}>{submitting ? 'Loading...' : 'Sign Up'}</Button>
    </form>
  )
}
