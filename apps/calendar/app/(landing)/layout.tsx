// app/(landing)/layout.tsx

import './landing.css'
import { Instrument_Sans, Inter, Geist } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { cn } from '@zntr/utils'
import type { Metadata } from 'next'
import type React from 'react'

const geistHeading = Geist({ subsets: ['latin'], variable: '--font-heading' })

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
})

export const APP_TITLE = 'One Calendar'
export const APP_SUBTITLE = 'Your life, stay safe.'

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_SUBTITLE,
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: APP_TITLE,
    description: APP_SUBTITLE,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@One__Cal',
    title: APP_TITLE,
    description: APP_SUBTITLE,
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
        'landing min-h-dvh font-sans antialiased',
        inter.variable,
        geistHeading.variable,
        GeistSans.className,
        instrumentSans.variable,
      )}
    >
      {children}
    </div>
  )
}
