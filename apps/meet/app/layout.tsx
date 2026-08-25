import './globals.css'
import { Geist } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@zntr/ui/sonner'
import { cn } from '@zntr/utils'
import { AVAILABLE_THEMES } from '@/lib/theme'
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
  // A pair, not one value: light mode is now reachable (see ThemeProvider
  // below), and a fixed near-black here paints the browser chrome dark around
  // a white page.
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
        {/* Matches the calendar's provider: system-aware, three options. It was
            `defaultTheme="dark" enableSystem={false}`, which meant meet's
            light-mode tokens in globals.css were unreachable and the theme
            setting the dashboard now offers would have had two of its three
            values do nothing. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={[...AVAILABLE_THEMES]}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
