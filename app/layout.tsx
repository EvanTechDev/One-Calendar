import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { CalendarProvider } from "@/contexts/CalendarContext"
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ClerkProvider } from '@clerk/nextjs'
import { enUS } from '@clerk/localizations'

const inter = Inter({ subsets: ["latin"] })

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
    <html lang="en">
      <body className={inter.className}> 
      <ClerkProvider 
        localization={enUS}
        fallbackRedirectUrl="https://calendar.xyehr.cn"
        forceRedirectUrl="https://calendar.xyehr.cn"
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
      >
        <CalendarProvider>
          {children}
          <Toaster />
          <SpeedInsights />
        </CalendarProvider> 
      </ClerkProvider>
      <Analytics />
      </body>
    </html>
  )
}

