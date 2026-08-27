'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  AccountProvider,
  type AccountClient,
  type AccountUser,
} from '@zntr/auth/account'
import { selectAuthCopy } from '@zntr/i18n/auth'
import { useLanguage } from '@zntr/i18n/calendar'
import { authClient } from '@/lib/auth/client'

/**
 * This app's half of the shared account panel.
 *
 * The panel itself lives in `@zntr/auth` and is identical in both apps; the
 * client, the copy, and — most importantly — what deleting an account means are
 * supplied here (ADR 0022).
 */
export function AccountHost({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [language] = useLanguage()
  const { data: session } = authClient.useSession()

  return (
    <AccountProvider
      value={{
        copy: selectAuthCopy(language),
        user: (session?.user as AccountUser | undefined) ?? null,
        client: authClient as unknown as AccountClient,
        // Better Auth's session store is the source of truth for the header
        // avatar and the guard on every server component, so a change made in
        // the panel has to reach it rather than only local state.
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
        // DELETE /api/account removes calendar_events, settings, categories,
        // countdowns and bookmarks alongside the user. That list is this app's
        // and nothing in the package should know it.
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
