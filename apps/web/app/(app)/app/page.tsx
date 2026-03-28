"use client"

import Calendar from "@/components/app/calendar"
import AuthWaitingLoading from "@/components/app/auth-waiting-loading"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useUser } from "@clerk/nextjs"
import { useEffect, useMemo, useState } from "react"

function hasClerkSessionCookie() {
  if (typeof document === "undefined") return false

  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim().startsWith("__session="))
}

export default function Home() {
  const { isLoaded, isSignedIn } = useUser()
  const [hasSessionCookie, setHasSessionCookie] = useState(hasClerkSessionCookie)
  const [minimumWaitDone, setMinimumWaitDone] = useState(false)
  const [atprotoLogoutDone, setAtprotoLogoutDone] = useState(false)
  const [dbReady, setDbReady] = useState(false)
  const [atprotoSignedIn, setAtprotoSignedIn] = useState(false)
  const [atprotoDs, setAtprotoDs] = useState<string | null>(null)
  const [dsDialogOpen, setDsDialogOpen] = useState(false)
  const [pendingDsInput, setPendingDsInput] = useState("")
  const [savingDs, setSavingDs] = useState(false)
  const [dsDialogError, setDsDialogError] = useState("")

  useEffect(() => {
    const waitTimer = window.setTimeout(() => {
      setMinimumWaitDone(true)
    }, 500)


    const cookieCheckTimer = window.setInterval(() => {
      if (hasClerkSessionCookie()) {
        setHasSessionCookie(true)
      }
    }, 50)

    return () => {
      window.clearTimeout(waitTimer)
      window.clearInterval(cookieCheckTimer)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || atprotoLogoutDone) return
    fetch("/api/atproto/logout", { method: "POST" })
      .catch(() => undefined)
      .finally(() => setAtprotoLogoutDone(true))
  }, [isLoaded, isSignedIn, atprotoLogoutDone])



  useEffect(() => {
    if (!isLoaded) return

    let active = true
    const checkDbDataReady = async () => {
      try {
        if (!isSignedIn) {
          const sessionRes = await fetch("/api/atproto/session", {
            cache: "no-store",
          })
          const sessionData = await sessionRes
            .json()
            .catch(() => ({ signedIn: false })) as { signedIn?: boolean }

          if (active) {
            setAtprotoSignedIn(!!sessionData.signedIn)
          }

          if (!sessionData.signedIn) {
            if (active) setDbReady(true)
            return
          }

          const dsRes = await fetch("/api/ds/config", { cache: "no-store" })
          const dsData = await dsRes
            .json()
            .catch(() => ({ ds: null })) as { ds?: string | null }
          if (active) {
            setAtprotoDs(dsData.ds || null)
            setPendingDsInput(dsData.ds || "")
            if (!dsData.ds) {
              setDsDialogOpen(true)
            }
            window.dispatchEvent(
              new CustomEvent("atproto-ds-updated", {
                detail: { ds: dsData.ds || null },
              }),
            )
          }
        }

        const response = await fetch("/api/blob", { cache: "no-store" })
        if (!active) return
        if (response.status === 200 || response.status === 404) {
          setDbReady(true)
          return
        }
        setDbReady(false)
      } catch {
        if (active) {
          setDbReady(false)
        }
      }
    }

    void checkDbDataReady()
    return () => {
      active = false
    }
  }, [isLoaded, isSignedIn])

  const shouldShowAuthWait = useMemo(() => {
    if (!minimumWaitDone) return true
    if (hasSessionCookie && !isLoaded) return true
    if (isSignedIn && !dbReady) return true
    return false
  }, [minimumWaitDone, hasSessionCookie, isLoaded, isSignedIn, dbReady])

  if (shouldShowAuthWait) {
    return <AuthWaitingLoading />
  }

  const saveDsFromDialog = async () => {
    setSavingDs(true)
    setDsDialogError("")
    try {
      const res = await fetch("/api/ds/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ds: pendingDsInput }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "failed to save ds")
      }
      setAtprotoDs(pendingDsInput)
      setDsDialogOpen(false)
      setDbReady(false)
      window.location.reload()
    } catch (error) {
      setDsDialogError((error as Error).message || "failed to save ds")
    } finally {
      setSavingDs(false)
    }
  }

  return (
    <>
      <Calendar />
      <Dialog open={dsDialogOpen && atprotoSignedIn && !atprotoDs}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set your DS endpoint</DialogTitle>
            <DialogDescription>
              You are signed in with ATProto but no app.onecalendar.ds is set.
              Please configure your DS URL to continue syncing data.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="https://your-ds.example.com"
            value={pendingDsInput}
            onChange={(e) => setPendingDsInput(e.target.value)}
          />
          {dsDialogError ? (
            <p className="text-sm text-red-500">{dsDialogError}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={saveDsFromDialog}
              disabled={savingDs || !pendingDsInput}
            >
              {savingDs ? "Saving..." : "Save DS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
