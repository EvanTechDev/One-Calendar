'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ShieldCheck, XCircle } from 'lucide-react'
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

  if (!client) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <ShieldCheck className="mx-auto size-12 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">
              Authorize {client.client_name ?? 'this application'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review the calendar access this application requested.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {scopes.map((scope) => (
            <div key={scope} className="rounded-md border px-3 py-2 text-sm">
              {scope}
            </div>
          ))}
          {resources.length > 0 ? (
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Resource: {resources.join(', ')}
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
        <CardFooter className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => void decide(false)}
          >
            Deny
          </Button>
          <Button disabled={submitting} onClick={() => void decide(true)}>
            {submitting ? 'Authorizing...' : 'Authorize'}
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
