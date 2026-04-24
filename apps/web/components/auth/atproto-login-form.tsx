'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function AtprotoLoginContent() {
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()

  const startLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ds/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle }),
      })

      const data = (await res.json()) as {
        authorizeUrl?: string
        error?: string
        message?: string
      }
      if (!res.ok || !data.authorizeUrl) {
        throw new Error(data.message || data.error || 'Failed to start DS OAuth login')
      }

      window.location.href = data.authorizeUrl
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const queryError = searchParams.get('reason') || searchParams.get('error') || ''

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">用 ATProto 登录</CardTitle>
          <CardDescription>
            输入 Bluesky handle，Web 会自动解析你的 app.onecalendar.ds 记录并跳转到你的 DS 授权。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="alice.bsky.social"
            autoComplete="username"
          />
          <Button
            className="w-full bg-[#0066ff] text-white hover:bg-[#0052cc]"
            onClick={startLogin}
            disabled={!handle || loading}
          >
            {loading ? 'Redirecting...' : 'Continue with DS OAuth'}
          </Button>
          {error || queryError ? (
            <p className="text-sm text-red-500">{error || queryError}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export function AtprotoLoginForm() {
  return (
    <Suspense
      fallback={
        <div className="text-center text-sm text-muted-foreground">Loading...</div>
      }
    >
      <AtprotoLoginContent />
    </Suspense>
  )
}
