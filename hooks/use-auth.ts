'use client'

import { useEffect, useState } from 'react'

export function useAuth() {
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/auth/session-secret')
      .then(async (res) => {
        setIsSignedIn(res.ok)
        if (res.ok) {
          const me = await fetch('/api/auth/me')
          if (me.ok) {
            const data = await me.json()
            setEmail(data.email || '')
          }
        }
      })
      .finally(() => setIsLoaded(true))
  }, [])

  return { isSignedIn, isLoaded, email }
}
