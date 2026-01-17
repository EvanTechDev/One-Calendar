import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { CalendarProvider } from "@/components/context/CalendarContext"
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ClerkProvider } from '@clerk/nextjs'
import { enUS } from '@clerk/localizations'
import { GeistSans } from "geist/font/sans"
import { Instrument_Serif } from "next/font/google"
import { ThemeProvider } from "@/components/context/theme-provider"

export const metadata: Metadata = {
  title: "One Calendar",
  description: "All your events in one place, beautifully organized.",
  themeColor: "#0066ff",
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

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: ["400"],
  display: "swap",
  preload: true,
})


export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="${instrumentSerif.variable} antialiased" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:wght@400&display=swap" />
      </head>
      <body className={GeistSans.className}> 
      <ClerkProvider 
        localization={enUS}
        fallbackRedirectUrl="/"
        forceRedirectUrl="/"
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
      >
        <ThemeProvider
            themes={['light', 'dark', 'blue', 'green']}
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

