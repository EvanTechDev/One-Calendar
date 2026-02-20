"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AtprotoLoginPage() {
  const [handle, setHandle] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()

  const oauthError = useMemo(() => {
    const code = searchParams.get("error")
    if (!code) return ""
    if (code === "oauth_state") return "OAuth state mismatch, please retry."
    if (code === "oauth_token") return "Failed to exchange OAuth token."
    if (code === "oauth_sub") return "OAuth response missing account DID."
    return "OAuth login failed. Please try again."
  }, [searchParams])

  const startOauth = async () => {
    try {
      setLoading(true)
      setError("")
      const res = await fetch("/api/atproto/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload?.error || "Failed to start atproto OAuth")
        return
      }
      window.location.href = payload.authUrl
    } catch {
      setError("Failed to start atproto OAuth")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Sign in with Bluesky / atproto</CardTitle>
            <CardDescription>Enter your handle and continue with OAuth on your PDS.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="handle">Handle</Label>
              <Input id="handle" placeholder="alice.bsky.social" value={handle} onChange={(e) => setHandle(e.target.value)} />
            </div>
            {oauthError ? <p className="text-sm text-red-500">{oauthError}</p> : null}
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <Button disabled={!handle || loading} onClick={startOauth}>
              {loading ? "Redirecting..." : "Continue with atproto OAuth"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
