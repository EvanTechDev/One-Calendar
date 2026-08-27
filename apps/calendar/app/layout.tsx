import './globals.css'
import { Instrument_Sans, Inter, Geist } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { headers } from 'next/headers'
import { cn } from '@zntr/utils'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { PwaProvider } from '@/components/providers/pwa-provider'
import { Toaster } from '@zntr/ui/sonner'
import { SwrProvider } from '@/components/providers/swr-provider'
import type { Metadata } from 'next'
import type React from 'react'
import { AVAILABLE_THEMES } from '@/lib/theme'
import { APP_SUBTITLE, APP_TITLE } from '@/lib/metadata'

const geistHeading = Geist({ subsets: ['latin'], variable: '--font-heading' })

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
})

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_SUBTITLE,
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: APP_TITLE,
    description: APP_SUBTITLE,
    url: '/',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn('font-sans', inter.variable, geistHeading.variable)}
    >
      <body
        className={`${GeistSans.className} ${instrumentSans.variable} antialiased`}
      >
        <ThemeProvider
          nonce={nonce}
          themes={[...AVAILABLE_THEMES]}
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SwrProvider>
            <PwaProvider />
            {children}
            <Toaster />
          </SwrProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
