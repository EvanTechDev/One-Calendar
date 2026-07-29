'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@zntr/ui/button'
import { Loader2, CheckCircle, XCircle, Bot } from 'lucide-react'

function AuthorizeForm() {
  const searchParams = useSearchParams()
  const code = searchParams.get('code')

  const [status, setStatus] = useState<
    'checking' | 'ready' | 'authorizing' | 'success' | 'error'
  >('checking')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!code) {
      setStatus('error')
      setErrorMsg('No authorization code provided.')
      return
    }
    setStatus('ready')
  }, [code])

  const handleAuthorize = async () => {
    if (!code) return
    setStatus('authorizing')

    try {
      const sessionRes = await fetch('/api/auth/get-session')
      const session = await sessionRes.json()
      if (!session?.user?.id) {
        throw new Error('Not authenticated')
      }

      const res = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_code: code,
          user_id: session.user.id,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error_description || 'Authorization failed')
      }

      setStatus('success')
      setTimeout(() => {
        window.close()
      }, 2000)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold">Authorization Granted</h1>
          <p className="text-muted-foreground">
            You have successfully authorized this application. You can close
            this window.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4">
          <XCircle className="h-16 w-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold">Authorization Failed</h1>
          <p className="text-muted-foreground">{errorMsg}</p>
          <Button variant="outline" onClick={() => window.close()}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-lg">
        <div className="text-center space-y-6">
          <div className="rounded-full bg-primary/10 p-4 inline-flex mx-auto">
            <Bot className="h-12 w-12 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold">Authorize Application</h1>
            <p className="text-sm text-muted-foreground">
              An AI agent is requesting access to your calendar data.
            </p>
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Code</span>
              <span className="font-mono font-medium">{code}</span>
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-200">
            This will allow the application to read and manage your calendar
            data based on the permissions configured in your MCP settings.
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.close()}
            >
              Deny
            </Button>
            <Button className="flex-1" onClick={handleAuthorize}>
              {status === 'authorizing' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Authorize
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthorizeForm />
    </Suspense>
  )
}
