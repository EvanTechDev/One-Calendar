import './globals.css'
import { Geist } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@zntr/ui/sonner'
import { cn } from '@zntr/utils'
import type { Metadata, Viewport } from 'next'
import type React from 'react'

// Same face and variable as the calendar, so `font-heading` in @zntr/ui
// resolves to the same type in both apps instead of falling back here.
const geistHeading = Geist({ subsets: ['latin'], variable: '--font-heading' })

export const metadata: Metadata = {
  title: 'Zentra Meet',
  description: 'Video meetings for the next gen calendar.',
  openGraph: {
    title: 'Zentra Meet',
    description: 'Video meetings for the next gen calendar.',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
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
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
