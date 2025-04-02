import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { CalendarProvider } from "@/contexts/CalendarContext"
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from "@vercel/speed-insights/next"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "One Calendar | Customize your day at your fingertips and save as much time as you want",
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
        <CalendarProvider>
          {children}
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </CalendarProvider>
      </body>
    </html>
  )
}

