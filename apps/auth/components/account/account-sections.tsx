'use client'

import { useEffect, useState } from 'react'
import {
  Laptop,
  LogOut,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Unplug,
} from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { Label } from '@zntr/ui/label'
import { InputOTP } from '@zntr/ui/input-otp'
import { Badge } from '@zntr/ui/badge'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

/**
 * Account management, which now lives only here (ADR 0021).
 *
 * The calendar previously carried all of this and meet linked to the calendar
 * for it. Both now link here, so there is one implementation of "change my
 * password" rather than one plus a link plus a gap.
 */

export interface PortalUser {
  id: string
  name: string
  email: string
  image?: string | null
  emailVerified: boolean
  twoFactorEnabled?: boolean | null
}

/** A titled group of rows, matching the calendar's settings vocabulary. */
function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4 border-b p-4 last:border-b-0 sm:p-6">
      <div className="space-y-1">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function OverviewSection({ user }: { user: PortalUser }) {
  return (
    <Section
      title="Your account"
      description="One account for Zentra Calendar and Zentra Meet."
    >
      <div className="flex items-start gap-4">
        <img
          src={user.image || '/user.png'}
          alt="avatar"
          width={64}
          height={64}
          className="size-16 shrink-0 rounded-full border object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="min-w-0 flex-1 space-y-1 pt-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {user.emailVerified ? (
              <Badge variant="secondary">Email verified</Badge>
            ) : (
              <Badge variant="destructive">Email not verified</Badge>
            )}
            {user.twoFactorEnabled ? (
              <Badge variant="secondary">Two-factor on</Badge>
            ) : null}
          </div>
        </div>
      </div>
    </Section>
  )
}

export function ProfileSection({ user }: { user: PortalUser }) {
  const [name, setName] = useState(user.name)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const { error } = await authClient.updateUser({ name: name || undefined })
    setSaving(false)
    if (error) {
      toast.error(error.message || 'Could not save your name')
      return
    }
    toast.success('Name updated')
  }

  return (
    <Section
      title="Profile"
      description="How you appear across every Zentra app."
    >
      <div className="grid max-w-sm gap-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <Button onClick={save} disabled={saving || name === user.name}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </Section>
  )
}

export function SecuritySection({ user }: { user: PortalUser }) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    Boolean(user.twoFactorEnabled),
  )
  const [password, setPassword] = useState('')
  const [totpUri, setTotpUri] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const enable = async () => {
    if (!password) return
    setBusy(true)
    const { data, error } = await authClient.twoFactor.enable({ password })
    setBusy(false)
    if (error) {
      toast.error(error.message || 'Could not start two-factor setup')
      return
    }
    setTotpUri((data as any)?.totpURI ?? '')
  }

  const confirm = async () => {
    if (code.length < 6) return
    setBusy(true)
    const { error } = await authClient.twoFactor.verifyTotp({ code })
    setBusy(false)
    if (error) {
      toast.error(error.message || 'That code was not accepted')
      return
    }
    setTwoFactorEnabled(true)
    setTotpUri('')
    setCode('')
    setPassword('')
    toast.success('Two-factor sign-in is on')
  }

  const disable = async () => {
    if (!password) return
    setBusy(true)
    const { error } = await authClient.twoFactor.disable({ password })
    setBusy(false)
    if (error) {
      toast.error(error.message || 'Could not turn two-factor off')
      return
    }
    setTwoFactorEnabled(false)
    setPassword('')
    toast.success('Two-factor sign-in is off')
  }

  return (
    <>
      <Section
        title="Password"
        description="Changing your password signs out your other devices."
      >
        <Button
          variant="outline"
          onClick={async () => {
            // Reuses the recovery flow rather than adding a second
            // change-password path: one implementation, and it already proves
            // control of the mailbox.
            const { error } = await authClient.requestPasswordReset({
              email: user.email,
              redirectTo: '/reset-password',
            })
            if (error) {
              toast.error(error.message || 'Could not send the reset email')
              return
            }
            toast.success('Check your email for a reset code')
          }}
        >
          Send a password reset code
        </Button>
      </Section>

      <Section
        title="Two-factor sign-in"
        description="An authenticator app code in addition to your password."
      >
        {twoFactorEnabled ? (
          <div className="max-w-sm space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="disable-password">
                Confirm your password to turn it off
              </Label>
              <Input
                id="disable-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button variant="destructive" onClick={disable} disabled={busy}>
              <ShieldOff className="size-4" />
              Turn off
            </Button>
          </div>
        ) : totpUri ? (
          <div className="max-w-sm space-y-3">
            {/*
              The URI is shown as text rather than only a QR code: a user on the
              same device as their authenticator cannot scan their own screen.
            */}
            <p className="text-sm text-muted-foreground">
              Add this to your authenticator app, then enter the code it shows.
            </p>
            <code className="block overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {totpUri}
            </code>
            <div className="grid gap-2">
              <Label>Code from your app</Label>
              <InputOTP
                value={code}
                onChange={(value) =>
                  setCode(value.replace(/\D/g, '').slice(0, 6))
                }
              />
            </div>
            <Button onClick={confirm} disabled={busy || code.length < 6}>
              <ShieldCheck className="size-4" />
              Confirm
            </Button>
          </div>
        ) : (
          <div className="max-w-sm space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="enable-password">Confirm your password</Label>
              <Input
                id="enable-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button onClick={enable} disabled={busy || !password}>
              <ShieldCheck className="size-4" />
              Set up
            </Button>
          </div>
        )}
      </Section>
    </>
  )
}

interface SessionRow {
  id: string
  createdAt?: string
  userAgent?: string | null
  ipAddress?: string | null
  current?: boolean
}

export function DevicesSection() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [grants, setGrants] = useState<
    { id: string; clientId: string; scopes?: unknown }[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const [sessionResult, consentResult] = await Promise.all([
        authClient.listSessions(),
        // Authorised apps: a grant a user can revoke without changing their
        // password, which is the point of having them listed at all.
        authClient.oauth2.getConsents({} as never).catch(() => null),
      ])
      setSessions(((sessionResult as any)?.data ?? []) as SessionRow[])
      setGrants(((consentResult as any)?.data ?? []) as never[])
      setLoading(false)
    })()
  }, [])

  return (
    <>
      <Section
        title="Signed-in devices"
        description="Revoke anything you do not recognise."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other sessions.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Laptop className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {session.userAgent || 'Unknown device'}
                    </p>
                    {session.ipAddress ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {session.ipAddress}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const { error } = await authClient.revokeSession({
                      token: session.id,
                    })
                    if (error) {
                      toast.error(error.message || 'Could not revoke it')
                      return
                    }
                    setSessions((current) =>
                      current.filter((row) => row.id !== session.id),
                    )
                  }}
                >
                  <LogOut className="size-4" />
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Authorised apps"
        description="Apps that can act on your behalf."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Zentra Calendar and Zentra Meet are first-party and do not appear
            here.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {grants.map((grant) => (
              <li
                key={grant.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="truncate text-sm">{grant.clientId}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const result: any = await authClient.oauth2.deleteConsent({
                      id: grant.id,
                    } as never)
                    if (result?.error) {
                      toast.error('Could not revoke that app')
                      return
                    }
                    setGrants((current) =>
                      current.filter((row) => row.id !== grant.id),
                    )
                    toast.success('Access revoked')
                  }}
                >
                  <Unplug className="size-4" />
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Delete your account"
        description="This removes your account and everything in it, in every Zentra app."
      >
        <Button
          variant="destructive"
          onClick={async () => {
            // Better Auth sends a confirmation email rather than deleting
            // immediately; a one-click irreversible delete is not a thing to
            // offer.
            const { error } = await authClient.deleteUser({})
            if (error) {
              toast.error(error.message || 'Could not start deletion')
              return
            }
            toast.success('Check your email to confirm deletion')
          }}
        >
          <Trash2 className="size-4" />
          Delete account
        </Button>
      </Section>
    </>
  )
}
