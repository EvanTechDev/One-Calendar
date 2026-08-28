'use client'

import { cn } from '@zntr/utils'
import { useScroll } from '@/hooks/use-scroll'
import { Button } from '@zntr/ui/button'
import { DesktopNav } from './desktop-nav'
import { MobileNav } from './mobile-nav'
import { ZentraLogo } from '@/components/brand/zentra-logo'
import Link from 'next/link'

export function Header() {
  const scrolled = useScroll(10)

  return (
    <header
      className={cn('sticky top-0 z-50 w-full border-transparent border-b', {
        'border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50':
          scrolled,
      })}
    >
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-5">
          <a
            className="rounded-lg px-3 py-2.5 hover:bg-muted dark:hover:bg-muted/50"
            href="/"
          >
            {/*
              Named, not decorative: this is the only content of the home link,
              so without a name the link is unlabelled for a screen reader.
            */}
            <ZentraLogo className="h-9 w-9" />
          </a>
          <DesktopNav />
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/sign-in">
            <Button variant="outline">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button>Get Started</Button>
          </Link>
        </div>
        <MobileNav />
      </nav>
    </header>
  )
}
