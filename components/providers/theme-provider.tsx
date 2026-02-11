'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

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
