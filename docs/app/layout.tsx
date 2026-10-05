import type { Metadata } from 'next'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { getBaseUrl } from '@/lib/base-url'
import { site } from '@/lib/site'
import './global.css'

export const metadata: Metadata = {
  metadataBase: getBaseUrl(),
  title: { default: site.name, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  appleWebApp: { title: site.name },
  openGraph: {
    siteName: site.name,
    locale: 'en_US',
    type: 'website',
    images: '/og/docs/image.png',
  },
  twitter: { card: 'summary_large_image' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
