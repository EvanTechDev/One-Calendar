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

export const metadata: Metadata = {
  title: "One Calendar",
  description: "All your events in one place, beautifully organized.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "One Calendar",
    description: "All your events in one place, beautifully organized.",
    url: "/",
    images: [
      {
        url: "https://calendar.xyehr.cn/og.png",
        width: 1200,
        height: 630,
        alt: "PreviewImage",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@One__Cal",
    title: "One Calendar",
    description: "All your events in one place, beautifully organized.",
    images: [
      {
        url: `https://calendar.xyehr.cn/og.png`,
        width: 1200,
        height: 630,
        alt: "Preview",
      },
    ],
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
