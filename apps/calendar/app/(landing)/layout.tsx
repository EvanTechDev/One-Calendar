import './landing.css'
import { Instrument_Sans, Inter, Geist } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { cn } from '@zntr/utils'
import { PwaProvider } from '@/components/providers/pwa-provider'
import { Toaster } from '@zntr/ui/sonner'
import { CalendarProvider } from '@/components/providers/calendar-context'
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn('font-sans', inter.variable, geistHeading.variable)}
    >
      <body
        className={cn(
          'landing',
          GeistSans.className,
          instrumentSans.variable,
          'antialiased',
        )}
      >
        <CalendarProvider>
          <PwaProvider />
          {children}
          <Toaster />
        </CalendarProvider>
      </body>
    </html>
  )
}
