import '../app/(landing)/landing.css'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import type { ReactNode } from 'react'
import { cn } from '@zntr/utils'

export function LandingSurface({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'landing min-h-dvh antialiased',
        GeistSans.className,
        GeistMono.variable,
      )}
    >
      {children}
    </div>
  )
}
