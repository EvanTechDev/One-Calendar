'use client'

import {
  CircleUserRound,
  ExternalLink,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { portalAccountUrl } from '@zntr/auth/handoff'
import { Button } from '@zntr/ui/button'
import { authClient } from '@/lib/auth/client'

/**
 * The account tab, which no longer edits anything (ADR 0021 decision 4).
 *
 * Every mutation — name, avatar, email, password, two-factor, deletion — moved
 * to the portal. This app cannot write user data, so there is nothing here for
 * an app-level bug to leak, and there is one implementation of "change my
 * password" instead of one per app.
 *
 * The forms this replaced were ~500 lines of `user-profile-button.tsx`. They are
 * deleted rather than hidden: dead code that can still write to the user table
 * is not dead in the way that matters.
 */
export function AccountHandoff() {
  const { data: session } = authClient.useSession()
  // Typed rather than `?? {}`: this renders before the session resolves, and an
  // untyped empty object made every field read a compile error waiting to be
  // silenced with `any`.
  const user: {
    name?: string | null
    email?: string | null
    image?: string | null
  } = session?.user ?? {}

  const portal = (process.env.NEXT_PUBLIC_AUTH_ORIGIN ?? '').replace(/\/$/, '')
  const self = (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '')

  const link = (section?: 'profile' | 'security') =>
    portalAccountUrl({
      portal,
      selfOrigin: self,
      // Bring the user back to the calendar rather than leaving them in the
      // portal after a one-field change.
      returnTo: '/app',
      ...(section ? { section } : {}),
    })

  return (
    <div className="space-y-6">
      <section className="flex items-start gap-4" aria-label="Your account">
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
        </div>
      </section>

      {/*
        Without a configured portal there is nowhere to send anyone, and a link
        to `/` would silently be a link to this app's own root. Saying so beats
        rendering a button that goes nowhere.
      */}
      {portal ? (
        <div className="space-y-3">
          <Row
            icon={<CircleUserRound />}
            title="Profile"
            description="Your name, avatar, and email address."
            href={link('profile')}
          />
          <Row
            icon={<ShieldCheck />}
            title="Password and two-factor"
            description="Sign-in credentials, devices, and authorised apps."
            href={link('security')}
          />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Account settings live in Zentra Account, which is not configured for
          this deployment.
        </p>
      )}

      <div className="border-t pt-4">
        <Button
          variant="destructive"
          size="sm"
          onClick={async () => {
            await authClient.signOut()
            window.location.assign('/')
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </div>
  )
}

function Row({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button variant="secondary" size="sm" asChild>
        <a href={href}>
          Open
          <ExternalLink className="size-3.5" />
        </a>
      </Button>
    </div>
  )
}
