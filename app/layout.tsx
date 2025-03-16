import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { CalendarProvider } from "@/contexts/CalendarContext"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "One Calendar",
  description: "A calendar application",
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
        </CalendarProvider>
      </body>
    </html>
  )
}

