'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import * as React from 'react';

export function ThemeProvider({
  children,
  themes = ['light', 'dark', 'green', 'orange', 'azalea'],
  ...props
}: React.ComponentProps<typeof NextThemesProvider> & {
  themes?: string[];
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      themes={themes}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
