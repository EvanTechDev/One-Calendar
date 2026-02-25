"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { initializeE2EEAccount, unlockAfterLogin } from "@/lib/e2ee/client"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const PENDING_KEY = "pending-signup-recovery-key"
const PENDING_USER = "pending-signup-recovery-user"
const ALLOW_INIT = "allow-signup-key-init"

export default function SignUpKeyPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [status, setStatus] = useState<"loading" | "ready" | "blocked" | "error">("loading")
  const [recoveryKey, setRecoveryKey] = useState("")
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn || !user) {
      setStatus("blocked")
      return
    }

    const pendingKey = sessionStorage.getItem(PENDING_KEY)
    const pendingUser = sessionStorage.getItem(PENDING_USER)
    if (pendingKey && pendingUser === user.id) {
      setRecoveryKey(pendingKey)
      setStatus("ready")
      return
    }

    const allowInit = sessionStorage.getItem(ALLOW_INIT) === "1"
    if (!allowInit) {
      setStatus("blocked")
      return
    }

    unlockAfterLogin(user.id)
      .then(() => {
        setStatus("blocked")
      })
      .catch(async (err) => {
        if (err instanceof Error && "code" in err && err.code === "E2EE_NOT_INITIALIZED") {
          try {
            const result = await initializeE2EEAccount(user.id)
            setRecoveryKey(result.recoveryKey)
            setStatus("ready")
          } catch (initErr) {
            setError(initErr instanceof Error ? initErr.message : "Failed to generate recovery key")
            setStatus("error")
          }
          return
        }
        setStatus("blocked")
      })
  }, [isLoaded, isSignedIn, user])

  const finish = () => {
    sessionStorage.removeItem(PENDING_KEY)
    sessionStorage.removeItem(PENDING_USER)
    sessionStorage.removeItem(ALLOW_INIT)
    router.replace("/app")
  }

  if (status === "loading") {
    return <div className="p-8 text-center text-sm text-muted-foreground">Preparing your recovery key...</div>
  }

  if (status === "blocked") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Recovery key is unavailable</CardTitle>
            <CardDescription>
              This page only works right after registration. No new recovery key was generated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.replace("/app")}>Go to app</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "error") {
    return <div className="p-8 text-center text-sm text-red-500">{error}</div>
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Save your recovery key</CardTitle>
          <CardDescription>
            Keep this key safely. You will need it to unlock encrypted data on a new device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="break-all rounded bg-muted p-3 font-mono text-xs">{recoveryKey}</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            I saved this recovery key securely.
          </label>
          <Button className="w-full" disabled={!saved} onClick={finish}>Continue to app</Button>
        </CardContent>
      </Card>
    </div>
  )
}
