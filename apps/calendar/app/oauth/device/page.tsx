'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@zntr/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@zntr/ui/card'
import { Input } from '@zntr/ui/input'
import { Label } from '@zntr/ui/label'
import { authClient } from '@/lib/auth/client'

type DeviceRequest = {
  client_id?: string
  scope?: string
  resource?: string | string[]
}

export default function OAuthDevicePage() {
  const searchParams = useSearchParams()
  const { data: session, isPending } = authClient.useSession()
  const suppliedCode = searchParams.get('user_code') ?? ''
  const [userCode, setUserCode] = useState(suppliedCode)
  const [request, setRequest] = useState<DeviceRequest | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!session?.user || !suppliedCode) return
    authClient
      .device({ query: { user_code: suppliedCode } })
      .then(({ data, error: deviceError }) => {
        if (deviceError || !data) {
          setError('Invalid or expired device code.')
          return
        }
        setRequest(data as DeviceRequest)
      })
  }, [session?.user, suppliedCode])

  const continueWithCode = () => {
    const normalized = userCode
      .trim()
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase()
    if (!normalized) return
    window.location.assign(
      `/oauth/device?user_code=${encodeURIComponent(normalized)}`,
    )
  }

  const decide = async (approve: boolean) => {
    setSubmitting(true)
    const result = approve
      ? await authClient.device.approve({ userCode: suppliedCode })
      : await authClient.device.deny({ userCode: suppliedCode })
    if (result.error) {
      setError(
        result.error.error_description ??
          'The device request could not be updated.',
      )
      setSubmitting(false)
      return
    }
    setRequest(null)
    setError(approve ? 'Device authorized.' : 'Device authorization denied.')
  }

  if (isPending) return null

  if (!session?.user) {
    const returnTo = suppliedCode
      ? `/oauth/device?user_code=${encodeURIComponent(suppliedCode)}`
      : '/oauth/device'
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1 className="text-xl font-semibold">
              Sign in to authorize a device
            </h1>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full">
              <a href={`/sign-in?redirect=${encodeURIComponent(returnTo)}`}>
                Sign in
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-xl font-semibold">Authorize a device</h1>
          <p className="text-sm text-muted-foreground">
            Approve only a code shown on a device in your possession.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {request ? (
            <>
              <p className="font-medium">
                {request.client_id ?? 'OAuth client'}
              </p>
              <p className="font-mono text-lg tracking-widest">
                {suppliedCode}
              </p>
              <p className="text-sm text-muted-foreground">
                {(request.scope ?? 'No scopes requested').split(' ').join(', ')}
              </p>
              <p className="break-all text-xs text-muted-foreground">
                Resource:{' '}
                {Array.isArray(request.resource)
                  ? request.resource.join(', ')
                  : (request.resource ?? 'Not specified')}
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="device-code">Device code</Label>
              <Input
                id="device-code"
                value={userCode}
                onChange={(event) => setUserCode(event.target.value)}
                placeholder="ABCD-1234"
                autoComplete="one-time-code"
              />
              <Button className="w-full" onClick={continueWithCode}>
                Continue
              </Button>
            </div>
          )}
          {error ? (
            <p className="text-sm text-muted-foreground">{error}</p>
          ) : null}
        </CardContent>
        {request ? (
          <CardFooter className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => void decide(false)}
            >
              Deny
            </Button>
            <Button disabled={submitting} onClick={() => void decide(true)}>
              Approve
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    </div>
  )
}
