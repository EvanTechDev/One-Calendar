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
import { ThemeProvider } from "@/components/context/theme-provider"

export const metadata: Metadata = {
  title: "One Calendar",
  description: "All your events in one place, beautifully organized.",
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

