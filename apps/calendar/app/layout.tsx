import "./globals.css";
import { Instrument_Sans, Inter, Geist } from "next/font/google";
import { GeistSans } from 'geist/font/sans';
import { cn } from "@/lib/utils";
import { ThemeProvider } from '@/components/providers/theme-provider';
import { PwaProvider } from '@/components/providers/pwa-provider';
import { Toaster } from '@zntr/ui/sonner'
import { CalendarProvider } from '@/components/providers/calendar-context'
import type { Metadata, Viewport } from 'next'
import type React from 'react'
import { AVAILABLE_THEMES } from '@/lib/theme'

const geistHeading = Geist({ subsets: ['latin'], variable: '--font-heading' })

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const instrumentSans = Instrument_Sans({ subsets: ["latin"] });

export const APP_TITLE = 'One Calendar'
export const APP_SUBTITLE = 'Your life, stay safe.'

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_SUBTITLE,
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: APP_TITLE,
    description: APP_SUBTITLE,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@One__Cal',
    title: APP_TITLE,
    description: APP_SUBTITLE,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn('font-sans', inter.variable, geistHeading.variable)}
    >
      <body
        className={`${GeistSans.className} ${instrumentSans.variable} antialiased`}
      >
        <ThemeProvider
          themes={[...AVAILABLE_THEMES]}
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
      </body>
    </html>
  );
}
