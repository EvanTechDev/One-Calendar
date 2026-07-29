'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@zntr/ui/button'
import { Loader2, CheckCircle, XCircle, Bot } from 'lucide-react'

type Flow = 'device_code' | 'auth_code' | null

function AuthorizeForm() {
  const searchParams = useSearchParams()

  const [status, setStatus] = useState<
    'checking' | 'ready' | 'authorizing' | 'success' | 'error'
  >('checking')
  const [errorMsg, setErrorMsg] = useState('')
  const [flow, setFlow] = useState<Flow>(null)
  const [clientInfo, setClientInfo] = useState({
    name: 'AI Agent',
    scopes: [] as string[],
    resource: '',
  })

  useEffect(() => {
    const responseType = searchParams.get('response_type')
    const deviceUserCode = searchParams.get('code')

    if (responseType === 'code') {
      setFlow('auth_code')
      const scopes = (searchParams.get('scope') ?? '')
        .split(' ')
        .filter(Boolean)
      setClientInfo({
        name:
          (searchParams.get('client_id') ?? 'AI Agent').slice(0, 12) + '...',
        scopes,
        resource: searchParams.get('resource') ?? '',
      })
      if (!searchParams.get('redirect_uri')) {
        setStatus('error')
        setErrorMsg('Missing redirect_uri parameter.')
        return
      }
      setStatus('ready')
    } else if (deviceUserCode) {
      setFlow('device_code')
      setStatus('ready')
    } else {
      setStatus('error')
      setErrorMsg('Invalid authorization request.')
    }
  }, [searchParams])

  const handleAuthorize = async () => {
    setStatus('authorizing')

    try {
      const sessionRes = await fetch('/api/auth/get-session')
      const session = await sessionRes.json()
      if (!session?.user?.id) {
        throw new Error('Not authenticated')
      }

      if (flow === 'device_code') {
        const code = searchParams.get('code')
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
        setTimeout(() => window.close(), 2000)
      } else if (flow === 'auth_code') {
        const redirectUri = searchParams.get('redirect_uri')!
        const state = searchParams.get('state') ?? ''

        const res = await fetch('/api/oauth/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            response_type: 'code',
            client_id: searchParams.get('client_id'),
            redirect_uri: redirectUri,
            scope: searchParams.get('scope'),
            code_challenge: searchParams.get('code_challenge'),
            code_challenge_method: searchParams.get('code_challenge_method'),
            state,
            resource: searchParams.get('resource'),
            user_id: session.user.id,
          }),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error_description || 'Authorization failed')
        }

        const data = await res.json()
        const redirectUrl = new URL(redirectUri)
        redirectUrl.searchParams.set('code', data.code)
        if (state) redirectUrl.searchParams.set('state', state)
        window.location.href = redirectUrl.toString()
      }
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
              {flow === 'auth_code'
                ? `"${clientInfo.name}" is requesting access to your calendar data.`
                : 'An AI agent is requesting access to your calendar data.'}
            </p>
          </div>

          {flow === 'auth_code' && clientInfo.scopes.length > 0 && (
            <div className="rounded-lg bg-muted p-3 text-left">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Requested permissions:
              </p>
              <div className="flex flex-wrap gap-1">
                {clientInfo.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          )}

          {flow === 'auth_code' && clientInfo.resource && (
            <div className="rounded-lg bg-muted p-3 text-left">
              <p className="text-xs text-muted-foreground">
                Resource:{' '}
                <span className="font-mono">{clientInfo.resource}</span>
              </p>
            </div>
          )}

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
