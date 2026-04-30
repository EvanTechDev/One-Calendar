'use client'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'

export function UserProfileButton() {
  const { isSignedIn, email } = useAuth()

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/sign-in'
  }

  if (!isSignedIn) {
    return <Button onClick={() => (window.location.href = '/sign-in')}>Sign in</Button>
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{email}</span>
      <Button variant="outline" onClick={logout}>Logout</Button>
    </div>
  )
}
