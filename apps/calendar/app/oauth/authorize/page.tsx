'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@zntr/ui/button'
import { Spinner } from '@zntr/ui/spinner'
import { Avatar, AvatarImage, AvatarFallback } from '@zntr/ui/avatar'
import { Badge } from '@zntr/ui/badge'
import { Card, CardContent, CardHeader, CardFooter } from '@zntr/ui/card'
import { CheckCircle, XCircle, ShieldAlert } from 'lucide-react'
import { authClient } from '@/lib/auth/client'

type Flow = 'device_code' | 'auth_code' | null

function AuthorizeForm() {
  const searchParams = useSearchParams()
  const { data: session, isPending: sessionLoading } = authClient.useSession()

  const [status, setStatus] = useState<
    'ready' | 'authorizing' | 'success' | 'error'
  >('ready')
  const [errorMsg, setErrorMsg] = useState('')
  const [flow, setFlow] = useState<Flow>(null)
  const [redirectUri, setRedirectUri] = useState('')
  const [scopes, setScopes] = useState<string[]>([])

  useEffect(() => {
    const responseType = searchParams.get('response_type')
    const deviceUserCode = searchParams.get('code')

    if (responseType === 'code') {
      setFlow('auth_code')
      setRedirectUri(searchParams.get('redirect_uri') ?? '')
      setScopes((searchParams.get('scope') ?? '').split(' ').filter(Boolean))
      if (!searchParams.get('redirect_uri')) {
        setStatus('error')
        setErrorMsg('Missing redirect_uri parameter.')
        return
      }
    } else if (deviceUserCode) {
      setFlow('device_code')
    } else {
      setStatus('error')
      setErrorMsg('Invalid authorization request.')
    }
  }, [searchParams])

  const handleAuthorize = async () => {
    setStatus('authorizing')

    try {
      if (flow === 'device_code') {
        const code = searchParams.get('code')
        const res = await fetch('/api/oauth/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_code: code,
            user_id: session?.user?.id,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error_description || 'Authorization failed')
        }
        setStatus('success')
        setTimeout(() => window.close(), 2000)
      } else if (flow === 'auth_code') {
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
            state: searchParams.get('state'),
            resource: searchParams.get('resource'),
            user_id: session?.user?.id,
          }),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error_description || 'Authorization failed')
        }

        const data = await res.json()
        const url = new URL(redirectUri)
        url.searchParams.set('code', data.code)
        const state = searchParams.get('state')
        if (state) url.searchParams.set('state', state)
        window.location.href = url.toString()
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const permissionGroups = (() => {
    const groups: Record<string, { read: boolean; write: boolean }> = {}
    for (const scope of scopes) {
      const [resource, action] = scope.split(':')
      if (!resource || !action) continue
      if (!groups[resource]) groups[resource] = { read: false, write: false }
      if (action === 'read') groups[resource].read = true
      if (action === 'write') groups[resource].write = true
    }

    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

    const rwEntries = Object.entries(groups)
      .filter(([, v]) => v.read && v.write)
      .map(([k]) => capitalize(k))
      .sort()
    const rEntries = Object.entries(groups)
      .filter(([, v]) => v.read && !v.write)
      .map(([k]) => capitalize(k))
      .sort()

    return [
      ...(rwEntries.length > 0
        ? [{ resources: rwEntries, badge: 'READ+WRITE' }]
        : []),
      ...(rEntries.length > 0 ? [{ resources: rEntries, badge: 'READ' }] : []),
    ]
  })()

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
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
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm rounded-lg">
        <CardHeader className="flex flex-col items-center gap-3">
          <Avatar size="lg" className="size-28">
            <AvatarImage src={session?.user?.image ?? ''} />
            <AvatarFallback className="text-2xl">
              {(session?.user?.name ?? 'U').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="text-lg font-semibold">{session?.user?.name}</p>
            <p className="text-sm text-muted-foreground">
              Authorize access to your calendar
            </p>
          </div>
        </CardHeader>

        {flow === 'device_code' && (
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              You are authorizing a device to access your calendar.
            </p>
          </CardContent>
        )}

        {flow === 'auth_code' && scopes.length > 0 && (
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                Make sure you trust this application. Authorizing will grant
                access based on the permissions shown above. You can revoke
                access anytime from your MCP settings.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Permissions
              </p>
              <div className="divide-y divide-border rounded-lg border border-border">
                {permissionGroups.map((group, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2.5"
                  >
                    <span className="text-sm text-foreground">
                      {group.resources.join(', ')}
                    </span>
                    <Badge variant="secondary" className="shrink-0 ml-2">
                      {group.badge}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        )}

        <CardFooter className="flex gap-3 border-t-0 bg-transparent px-4 pb-4 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => window.close()}
          >
            Deny
          </Button>
          <Button
            className="flex-1"
            onClick={handleAuthorize}
            disabled={status === 'authorizing'}
          >
            {status === 'authorizing' ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : null}
            Authorize
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthorizeForm />
    </Suspense>
  )
}
