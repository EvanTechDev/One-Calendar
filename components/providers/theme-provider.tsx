'use client'

import {
  AVAILABLE_THEMES,
  normalizeTheme,
  THEME_STORAGE_KEY,
} from '@/lib/theme'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import * as React from 'react'

function ThemeStorageNormalizer() {
  const { theme, setTheme } = useTheme()

  React.useEffect(() => {
    const normalizedTheme = normalizeTheme(theme)

    if (normalizedTheme && normalizedTheme !== theme) {
      setTheme(normalizedTheme)
      return
    }

    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
      const normalizedStoredTheme = normalizeTheme(storedTheme)

      if (normalizedStoredTheme && normalizedStoredTheme !== storedTheme) {
        setTheme(normalizedStoredTheme)
      }
    } catch {}
  }, [theme, setTheme])

  return null
}

type ThemeProviderProps = Omit<
  React.ComponentProps<typeof NextThemesProvider>,
  'themes'
> & {
  themes?: readonly string[]
}

export function ThemeProvider({
  children,
  themes = AVAILABLE_THEMES,
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      themes={[...themes]}
      {...props}
    >
      <ThemeStorageNormalizer />
      {children}
    </NextThemesProvider>
  )
}
