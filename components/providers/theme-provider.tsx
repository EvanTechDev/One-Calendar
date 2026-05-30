'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import * as React from 'react'

const AVAILABLE_THEMES = ['light', 'dark']
const THEME_STORAGE_KEY = 'theme'

const themeStorageGuard = `
try {
  var theme = localStorage.getItem('${THEME_STORAGE_KEY}');
  if (theme && theme !== 'light' && theme !== 'dark' && theme !== 'system') {
    localStorage.setItem('${THEME_STORAGE_KEY}', 'system');
  }
} catch (_) {}
`

export function ThemeProvider({
  children,
  themes = AVAILABLE_THEMES,
  ...props
}: React.ComponentProps<typeof NextThemesProvider> & {
  themes?: string[]
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeStorageGuard }} />
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        themes={[...themes]}
        {...props}
      >
        {children}
      </NextThemesProvider>
    </>
  )
}
