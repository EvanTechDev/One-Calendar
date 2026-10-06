'use client'

import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarHostProvider,
  type CalendarHost,
} from '@zntr/utils/calendar-host'
import { authClient } from '@/lib/auth/client'
import { ConnectionBoundary } from '@zntr/ui/calendar/components/connection-boundary'

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
  const { data, isPending, error } = authClient.useSession()
  const [remembered, setRemembered] = useState(data?.user)
  useEffect(() => {
    if (data?.user) setRemembered(data.user)
    else if (!isPending && !error) setRemembered(undefined)
  }, [data?.user, isPending, error])
  const user = data?.user ?? (isPending || error ? remembered : undefined)
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

  return (
    <CalendarHostProvider value={host}>
      <ConnectionBoundary>{children}</ConnectionBoundary>
    </CalendarHostProvider>
  )
}
