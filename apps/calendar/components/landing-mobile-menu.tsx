'use client'

import { useRef, type ReactNode } from 'react'
import { Menu, X } from 'lucide-react'

export function LandingMobileMenu({ children }: { children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null)

  return (
    <details
      className="landing-mobile-menu"
      ref={menu}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('a')) {
          event.currentTarget.open = false
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && menu.current?.open) {
          event.preventDefault()
          menu.current.open = false
          menu.current.querySelector('summary')?.focus()
        }
      }}
    >
      <summary aria-label="Toggle navigation">
        <Menu className="landing-menu-open" aria-hidden="true" />
        <X className="landing-menu-close" aria-hidden="true" />
      </summary>
      {children}
    </details>
  )
}
