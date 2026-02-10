import type { ReactNode } from "react"
import type { Viewport } from "next"
import { ThemeProvider } from "@/components/context/theme-provider"

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function AppPageLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      themes={["light", "dark", "green", "orange", "azalea", "pink", "crimson"]}
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  )
}
