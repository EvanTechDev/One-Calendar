import type React from 'react'
import type { Metadata, Viewport } from 'next'
import {
  Instrument_Sans,
  Instrument_Serif,
  JetBrains_Mono,
  Inter,
  Geist_Mono,
} from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { CalendarProvider } from '@/components/providers/calendar-context'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { PwaProvider } from '@/components/providers/pwa-provider'
import { cn } from '@/lib/utils'
import { AVAILABLE_THEMES } from '@/lib/theme'

const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })
const interHeading = Inter({ subsets: ['latin'], variable: '--font-heading' })
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
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

export const viewport: Viewport = {
  themeColor: '#0b0f1a',
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
      className={cn(
        'font-sans',
        inter.variable,
        interHeading.variable,
        geistMono.variable,
      )}
    >
      <body
        className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider
          themes={[...AVAILABLE_THEMES]}
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <CalendarProvider>
            <PwaProvider />
            {children}
            <Toaster />
          </CalendarProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
