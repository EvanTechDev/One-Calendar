import type { ReactNode } from "react"
import type { Viewport } from "next"

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function AppPageLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
