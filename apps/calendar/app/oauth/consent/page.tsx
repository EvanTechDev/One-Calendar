'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ShieldAlert, XCircle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@zntr/ui/avatar'
import { Badge } from '@zntr/ui/badge'
import { Button } from '@zntr/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@zntr/ui/card'
import { Spinner } from '@zntr/ui/spinner'
import { oauthAuthClient } from '@/lib/auth/oauth-client'

type PublicClient = {
  client_id: string
  client_name?: string
  client_uri?: string
}

function ConsentForm() {
  const searchParams = useSearchParams()
  const oauthQuery = searchParams.toString()
  const clientId = searchParams.get('client_id') ?? ''
  const scopes = (searchParams.get('scope') ?? '').split(' ').filter(Boolean)
  const resources = searchParams.getAll('resource')
  const [client, setClient] = useState<PublicClient | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { data: session, isPending: sessionLoading } =
    oauthAuthClient.useSession()

  useEffect(() => {
    if (!clientId || !oauthQuery) {
      setError('Invalid authorization request.')
      return
    }
    oauthAuthClient.oauth2
      .publicClientPrelogin({ client_id: clientId, oauth_query: oauthQuery })
      .then(({ data, error: clientError }) => {
        if (clientError || !data) {
          setError('Invalid or expired authorization request.')
          return
        }
        setClient(data as PublicClient)
      })
  }, [clientId, oauthQuery])

  const decide = async (accept: boolean) => {
    setSubmitting(true)
    setError('')
    const result = await oauthAuthClient.oauth2.consent({
      accept,
      oauth_query: oauthQuery,
    })
    const target =
      (result.data as { url?: string; redirect_uri?: string } | null)?.url ??
      (result.data as { redirect_uri?: string } | null)?.redirect_uri
    if (result.error || !target) {
      setError(result.error?.message ?? 'Authorization could not be completed.')
      setSubmitting(false)
      return
    }
    window.location.assign(target)
  }

  const permissionGroups = (() => {
    const grouped: Record<string, { read: boolean; write: boolean }> = {}
    for (const scope of scopes) {
      const [resource, action] = scope.split(':')
      if (!resource || !action) continue
      grouped[resource] ??= { read: false, write: false }
      if (action === 'read') grouped[resource].read = true
      if (action === 'write') grouped[resource].write = true
    }

    const label = (value: string) =>
      value.charAt(0).toUpperCase() + value.slice(1)
    const readWrite = Object.entries(grouped)
      .filter(([, access]) => access.read && access.write)
      .map(([resource]) => label(resource))
      .sort()
    const readOnly = Object.entries(grouped)
      .filter(([, access]) => access.read && !access.write)
      .map(([resource]) => label(resource))
      .sort()

    return [
      ...(readWrite.length
        ? [{ resources: readWrite, badge: 'READ+WRITE' }]
        : []),
      ...(readOnly.length ? [{ resources: readOnly, badge: 'READ' }] : []),
      ...(scopes.includes('offline_access')
        ? [{ resources: ['Offline access'], badge: 'LONG-LIVED' }]
        : []),
    ]
  })()

  if (error && !client) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="space-y-4 text-center">
          <XCircle className="mx-auto size-14 text-destructive" />
          <h1 className="text-2xl font-semibold">Authorization unavailable</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!client || sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm rounded-lg">
        <CardHeader className="flex flex-col items-center gap-3">
          <Avatar size="lg" className="size-32">
            <AvatarImage src={session?.user?.image ?? ''} />
            <AvatarFallback className="text-2xl">
              {(session?.user?.name ?? 'U').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="text-lg font-semibold">
              {session?.user?.name ?? 'Zentra user'}
            </p>
            <p className="text-sm text-muted-foreground">
              {client.client_name ?? 'This application'} wants access to your
              calendar
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/20">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
              Make sure you trust this application. It receives only the
              permissions listed below, and you can revoke access at any time
              from MCP settings.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Permissions
            </p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {permissionGroups.map((group) => (
                <div
                  key={group.badge}
                  className="flex items-center justify-between px-3 py-2.5"
                >
                  <span className="text-sm text-foreground">
                    {group.resources.join(', ')}
                  </span>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    {group.badge}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {resources.length > 0 ? (
            <p className="break-all text-xs text-muted-foreground">
              Access target: {resources.join(', ')}
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
        <CardFooter className="flex gap-3 border-t-0 bg-transparent px-4 pb-4 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={submitting}
            onClick={() => void decide(false)}
          >
            Deny
          </Button>
          <Button
            className="flex-1"
            disabled={submitting}
            onClick={() => void decide(true)}
          >
            {submitting ? <Spinner className="mr-2 size-4" /> : null}
            Authorize
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function OAuthConsentPage() {
  return (
    <Suspense>
      <ConsentForm />
    </Suspense>
  )
}
