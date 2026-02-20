import { Suspense } from "react"
import { AtprotoLoginClient } from "./atproto-login-client"

export default function AtprotoLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-svh" />}>
      <AtprotoLoginClient />
    </Suspense>
  )
}
