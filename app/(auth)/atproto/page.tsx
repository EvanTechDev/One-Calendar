"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AtprotoLoginPage() {
  const [handle, setHandle] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

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
