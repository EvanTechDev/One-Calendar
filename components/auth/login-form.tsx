'use client'
import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deriveAuthHash } from '@/lib/crypto'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const salts = await fetch(`/api/auth/salt?email=${encodeURIComponent(email)}`).then((r) => r.json())
    const authHash = await deriveAuthHash(password, salts.authSalt)
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, authHash }) })
    if (res.ok) window.location.href = '/app'
  }

  return <form onSubmit={onSubmit} className='space-y-3'><Input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder='Email' /><Input type='password' value={password} onChange={(e)=>setPassword(e.target.value)} placeholder='Password' /><Button type='submit'>Login</Button></form>
}
