import type { ReactNode } from 'react'
import type { Viewport } from 'next'
import { DataProvider } from '@/components/providers/data-provider'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function AppPageLayout({ children }: { children: ReactNode }) {
  // DataProvider stays scoped to the signed-in calendar app — public pages
  // (landing, share, privacy, …) mount outside it and make zero data requests.
  return <DataProvider>{children}</DataProvider>
}
