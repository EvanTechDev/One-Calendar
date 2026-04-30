'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ResetPasswordForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Placeholder until dedicated password-reset API is implemented.
    setSent(true)
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <Button type="submit" className="w-full">
        Send reset link
      </Button>
      {sent ? (
        <p className="text-sm text-muted-foreground">
          If this email exists, a reset link will be sent.
        </p>
      ) : null}
    </form>
  )
}

export const ResetForm = ResetPasswordForm
