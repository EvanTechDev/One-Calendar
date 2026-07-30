'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@zntr/ui/button'
import { Spinner } from '@zntr/ui/spinner'
import { Avatar, AvatarImage, AvatarFallback } from '@zntr/ui/avatar'
import { CheckCircle, XCircle } from 'lucide-react'
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

  useEffect(() => {
    const responseType = searchParams.get('response_type')
    const deviceUserCode = searchParams.get('code')

    if (responseType === 'code') {
      setFlow('auth_code')
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
            user_id: session?.user?.id,
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex justify-center">
          <Avatar size="lg" className="size-20">
            <AvatarImage src={session?.user?.image ?? ''} />
            <AvatarFallback>
              {(session?.user?.name ?? 'U').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          An application is requesting access to your calendar data.
          <br />
          Please review and confirm if you trust this application.
        </p>

        <Button
          className="w-full h-12 text-base"
          onClick={handleAuthorize}
          disabled={status === 'authorizing'}
        >
          {status === 'authorizing' ? (
            <Spinner className="mr-2 h-5 w-5" />
          ) : null}
          Confirm Authorization
        </Button>
      </div>
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
