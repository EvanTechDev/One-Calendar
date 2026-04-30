'use client'
import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deriveAuthHash, deriveMasterKey, randomBytes, wrapMasterKeyForBackup } from '@/lib/crypto'

export function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const authSalt = btoa(String.fromCharCode(...randomBytes(16)))
    const keySalt = btoa(String.fromCharCode(...randomBytes(16)))
    const backupSalt = btoa(String.fromCharCode(...randomBytes(16)))
    const authHash = await deriveAuthHash(password, authSalt)
    const masterKey = await deriveMasterKey(password, keySalt)
    const wrapped = await wrapMasterKeyForBackup(masterKey, password, backupSalt)
    const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, authSalt, keySalt, backupSalt, authHash, wrappedMasterKey: wrapped.blob, wrappedMasterKeyIv: wrapped.iv }) })
    if (res.ok) window.location.href = '/app'
  }

  return <form onSubmit={onSubmit} className='space-y-3'><Input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder='Email' /><Input type='password' value={password} onChange={(e)=>setPassword(e.target.value)} placeholder='Password' /><Button type='submit'>Sign Up</Button></form>
}
