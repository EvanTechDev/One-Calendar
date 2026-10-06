'use client'

import { lazy, Suspense, useMemo, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarHostProvider, type CalendarHost } from '@zntr/calendar-host'
import { authClient } from '@/lib/auth/client'

const request: typeof fetch = (input, init) => fetch(input, init)
const AccountPanel = lazy(() => import('../app/profile/web-account-panel'))
const renderAccount = (section?: string | null) => (
  <Suspense fallback={null}>
    <AccountPanel section={section} />
  </Suspense>
)

function openExternal(to: string) {
  if (to.startsWith('mailto:')) {
    window.location.assign(to)
    return
  }
  window.open(to, '_blank', 'noopener,noreferrer')
}

export function CalendarWebHost({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { data, isPending } = authClient.useSession()
  const user = data?.user
  const navigation = useMemo(
    () => ({
      push: (to: string) => router.push(to),
      replace: (to: string) => router.replace(to),
      openExternal,
    }),
    [router],
  )
  const host = useMemo<CalendarHost>(
    () => ({
      request,
      platform: 'web',
      renderAccount,
      session: { data: user ? { user } : null, isPending },
      navigation,
    }),
    [user, isPending, navigation],
  )

  return <CalendarHostProvider value={host}>{children}</CalendarHostProvider>
}
