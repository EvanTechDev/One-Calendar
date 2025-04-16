import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { CalendarProvider } from "@/contexts/CalendarContext"
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ClerkProvider } from '@clerk/nextjs'
import { enUS } from '@clerk/localizations'
import { GeistSans } from "geist/font/sans"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: "One Calendar | Get organized and make the most of your time",
  description: "One Calendar is a calendar web app that uses React + Vercel/blob for storage. It has rich features, such as: address book, notes, bookmarks, to-do lists and analysis features!",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={GeistSans.className}> 
      <ClerkProvider 
        localization={enUS}
        fallbackRedirectUrl="/"
        forceRedirectUrl="/"
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
      >
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
        <CalendarProvider>
          {children}
          <Toaster />
          <SpeedInsights />
        </CalendarProvider> 
        </ThemeProvider>
      </ClerkProvider>
      <Analytics />
      </body>
    </html>
  )
}

