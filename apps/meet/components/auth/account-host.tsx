'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  AccountProvider,
  type AccountClient,
  type AccountUser,
} from '@zntr/auth/account'
import { selectAuthCopy } from '@zntr/i18n/auth'
import { authClient } from '@/lib/auth/client'

/**
 * This app's half of the shared account panel.
 *
 * Meet used to show a card linking to the calendar, because its auth route
 * exposed only session-read and sign-out — every mutation had to happen where the
 * CAPTCHA and audit logging were. Both moved into `@zntr/auth`, so this app can
 * now perform them itself (ADR 0022).
 *
 * English for now: meet has no language picker, and the shared copy falls back to
 * English for any key a locale has not reached, so this reads the same as it did.
 */
export function AccountHost({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { data: session } = authClient.useSession()

  return (
    <AccountProvider
      value={{
        copy: selectAuthCopy('en'),
        user: (session?.user as AccountUser | undefined) ?? null,
        client: authClient as unknown as AccountClient,
        refetchSession: async () => {
          await (
            authClient as unknown as {
              $store: {
                atoms: {
                  session: { get: () => { refetch: () => Promise<void> } }
                }
              }
            }
          ).$store.atoms.session
            .get()
            .refetch()
        },
        // replace, not push: after a sign-out or a deletion the previous entry
        // is a page the user can no longer see, and Back would land them on a
        // server-guarded route that only bounces them here again.
        navigate: (to) => router.replace(to),
        // DELETE /api/account here removes the user's meetings and their sessions,
        // attendance and chat. The calendar's endpoint removes calendar_events,
        // settings and categories instead — which is exactly why the shared panel
        // takes a function rather than a path.
        deleteAccount: async () => {
          const response = await fetch('/api/account', { method: 'DELETE' })
          if (response.ok) return { ok: true }
          const data = (await response.json().catch(() => ({}))) as {
            error?: string
          }
          return { ok: false, error: data.error }
        },
        signInHref: '/sign-in',
      }}
    >
      {children}
    </AccountProvider>
  )
}
