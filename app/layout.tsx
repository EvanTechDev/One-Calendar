import type React from "react"
import type { Metadata, Viewport } from "next"
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { CalendarProvider } from "@/components/providers/calendar-context"
import { ClerkProvider } from '@clerk/nextjs'
import { enUS } from '@clerk/localizations'
import { GeistSans } from "geist/font/sans"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { PwaProvider } from "@/components/providers/pwa-provider"

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
})

export const APP_TITLE = "One Calendar"
export const APP_SUBTITLE = "Your life, stay safe."

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_SUBTITLE,
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: APP_TITLE,
    description: APP_SUBTITLE,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    site: "@One__Cal",
    title: APP_TITLE,
    description: APP_SUBTITLE,
  },
}

export const viewport: Viewport = {
  themeColor: "#0b0f1a",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.className} ${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ClerkProvider
          localization={enUS}
          fallbackRedirectUrl="/"
          forceRedirectUrl="/"
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
        >
          <ThemeProvider
            themes={['light', 'dark', 'green', 'orange', 'azalea']}
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
        </ClerkProvider>
      </body>
    </html>
  )
}
