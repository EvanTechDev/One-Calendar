'use client'

import { createContext, useContext, type ReactNode } from 'react'

export interface CalendarUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  emailVerified?: boolean
  twoFactorEnabled?: boolean | null
}

/** UI identity only. Session credentials belong to the platform adapter. */
export interface CalendarSession {
  data: { user: CalendarUser } | null
  isPending: boolean
}

export interface CalendarHost {
  request: typeof fetch
  session: CalendarSession
  navigation: {
    push: (to: string) => void
    replace: (to: string) => void
    openExternal: (to: string) => void
  }
}

const HostContext = createContext<CalendarHost | null>(null)

export function CalendarHostProvider({
  value,
  children,
}: {
  value: CalendarHost
  children: ReactNode
}) {
  return <HostContext.Provider value={value}>{children}</HostContext.Provider>
}

export function useCalendarHost(): CalendarHost {
  const host = useContext(HostContext)
  if (!host) {
    throw new Error('Calendar UI must be rendered inside CalendarHostProvider')
  }
  return host
}
