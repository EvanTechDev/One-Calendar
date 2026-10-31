import './landing.css'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { cn } from '@zntr/utils'
import type { Metadata } from 'next'
import type React from 'react'
import { APP_TITLE } from '@/lib/metadata'

const description =
  'Plan in day, four-day, week, month, and year views. Organize recurring events, invitations, and reminders, or connect an AI assistant with MCP.'

export const metadata: Metadata = {
  title: APP_TITLE,
  description,
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: APP_TITLE,
    description,
    url: '/',
  },
}

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'landing min-h-dvh antialiased',
        GeistSans.className,
        GeistMono.variable,
      )}
    >
      {children}
    </div>
  )
}
