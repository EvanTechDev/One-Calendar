import "./globals.css";
import { Instrument_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

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

export default function EfferdLayout({
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
        className={`${GeistSans.className} ${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} antialiased`}
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
