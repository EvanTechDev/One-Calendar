import './globals.css'
import { Geist } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@zntr/ui/sonner'
import { cn } from '@zntr/utils'
import type { Metadata, Viewport } from 'next'
import type React from 'react'

// Same face and variable as the other apps, so `font-heading` in @zntr/ui
// resolves to the same type here rather than falling back.
const geistHeading = Geist({ subsets: ['latin'], variable: '--font-heading' })

export const metadata: Metadata = {
  title: 'Zentra Account',
  description: 'Sign in and manage your Zentra account.',
  // The portal must never be indexed: its URLs carry OAuth protocol parameters,
  // and a crawled authorization request is a leaked one.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

// Every page depends on the request (session cookies); skip static prerender.
export const dynamic = 'force-dynamic'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(geistHeading.variable)}
    >
      <body className={`${GeistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
