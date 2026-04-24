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
  const [dsUrl, setDsUrl] = useState('')
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
        body: JSON.stringify({ ds: dsUrl }),
      })

      const data = (await res.json()) as {
        authorizeUrl?: string
        error?: string
      }
      if (!res.ok || !data.authorizeUrl) {
        throw new Error(data.error || 'Failed to start DS OAuth login')
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
          <CardTitle className="text-xl">用 Bluesky 登录</CardTitle>
          <CardDescription>
            输入你的 DS 地址，Web 会使用 PKCE 跳转到该 DS 完成授权。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={dsUrl}
            onChange={(e) => setDsUrl(e.target.value)}
            placeholder="https://your-ds.example"
            autoComplete="url"
          />
          <Button
            className="w-full bg-[#0066ff] text-white hover:bg-[#0052cc]"
            onClick={startLogin}
            disabled={!dsUrl || loading}
          >
            {loading ? 'Redirecting...' : 'Continue with your DS'}
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
