'use client'

import { useEffect, useState } from 'react'
import { Button } from '@zntr/ui/button'
import { authClient } from '@/lib/auth-client'
import { AuthLayout } from './auth-layout'

/**
 * What a client is asking for, and the two answers.
 *
 * Scope names come from the provider's public-client endpoint rather than from
 * the query string. A page that rendered scope names supplied by the caller
 * would let a request display "read your name" while actually asking for
 * everything — the consent would be real and the disclosure a lie.
 */
interface PublicClient {
  client_name?: string
  scope?: string
  client_uri?: string
}

/** Scope names a user cannot be expected to interpret, in plain words. */
const SCOPE_LABELS: Record<string, string> = {
  openid: 'Confirm who you are',
  profile: 'See your name and profile picture',
  email: 'See your email address',
  offline_access: 'Stay signed in when you are away',
}

export function ConsentForm() {
  const [client, setClient] = useState<PublicClient | null>(null)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // The provider resolves which client is asking from the pending
    // authorization request it holds, so no client id is passed from here.
    authClient.oauth2
      .publicClient({} as never)
      .then((result: any) => {
        if (result?.error) {
          setLoadError(result.error.message || 'Could not load this request.')
          return
        }
        setClient(result?.data ?? null)
      })
      .catch(() => setLoadError('Could not load this request.'))
  }, [])

  const decide = async (accept: boolean) => {
    setSubmitting(true)
    // The provider owns the redirect: it knows the request's redirect_uri and
    // state. Navigating from here would mean re-deriving both from data the
    // browser holds, which is how a redirect target gets substituted.
    const result: any = await authClient.oauth2.consent({ accept } as never)
    const url = result?.data?.redirectURI ?? result?.data?.url
    if (typeof url === 'string') {
      window.location.assign(url)
      return
    }
    setSubmitting(false)
    setLoadError('Could not complete this request.')
  }

  const scopes = (client?.scope ?? '')
    .split(' ')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0)

  return (
    <AuthLayout
      title={
        client?.client_name
          ? `Allow ${client.client_name}?`
          : 'Allow this application?'
      }
      description="It is asking for access to your Zentra account."
    >
      <div className="flex flex-col gap-6">
        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : null}

        {scopes.length > 0 ? (
          <ul className="space-y-2 rounded-lg border p-4 text-sm">
            {scopes.map((scope) => (
              <li key={scope} className="flex gap-2">
                <span aria-hidden className="text-muted-foreground">
                  •
                </span>
                {/* An unrecognised scope shows its raw name rather than being
                    hidden: the user must see everything being requested, even
                    the part we have no wording for. */}
                <span>{SCOPE_LABELS[scope] ?? scope}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={submitting}
            onClick={() => decide(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={submitting}
            onClick={() => decide(true)}
          >
            {submitting ? 'Continuing…' : 'Allow'}
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}
