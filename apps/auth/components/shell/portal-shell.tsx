'use client'

import { useState } from 'react'
import {
  CircleUserRound,
  Info,
  LayoutGrid,
  Menu,
  MonitorSmartphone,
  ShieldCheck,
} from 'lucide-react'
import Image from 'next/image'
import { Button } from '@zntr/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@zntr/ui/sheet'
import { cn } from '@zntr/utils'

/**
 * The portal's Shell.
 *
 * Byte-identical structure to the calendar's `/app` and meet's dashboard: a
 * `relative flex h-dvh overflow-hidden bg-background` outer, a `w-[247px]`
 * bordered rail, and a `flex min-h-0 min-w-0 flex-1 flex-col` main column whose
 * header is `h-16` with a bottom border. Seams on one shared background rather
 * than floating panels — the three apps have to read as one product, and a
 * rounded card here would read as a different one.
 *
 * Below `sm` the rail becomes a Sheet, matching meet. The calendar has no mobile
 * shell to copy; `sm` (640px) is the repo's convention.
 */

export type PortalSection =
  | 'overview'
  | 'profile'
  | 'security'
  | 'apps'
  | 'about'

const NAV: {
  id: PortalSection
  label: string
  icon: React.ReactNode
}[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutGrid /> },
  { id: 'profile', label: 'Profile', icon: <CircleUserRound /> },
  { id: 'security', label: 'Security', icon: <ShieldCheck /> },
  { id: 'apps', label: 'Devices & apps', icon: <MonitorSmartphone /> },
  { id: 'about', label: 'About', icon: <Info /> },
]

interface PortalShellProps {
  section: PortalSection
  onSectionChange: (section: PortalSection) => void
  /** Shown at the right of the header. */
  identity?: React.ReactNode
  children: React.ReactNode
}

export function PortalShell({
  section,
  onSectionChange,
  identity,
  children,
}: PortalShellProps) {
  const [navOpen, setNavOpen] = useState(false)
  const title = NAV.find((item) => item.id === section)?.label ?? 'Account'

  return (
    <div className="relative flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-[247px] shrink-0 overflow-y-auto border-r bg-background sm:flex sm:flex-col">
        <SidebarBody section={section} onSectionChange={onSectionChange} />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative z-40 flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="sm:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[247px] p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody
                section={section}
                onSectionChange={(next) => {
                  onSectionChange(next)
                  setNavOpen(false)
                }}
              />
            </SheetContent>
          </Sheet>

          <h1 className="font-heading truncate text-base font-semibold">
            {title}
          </h1>
          {identity ? (
            <div className="ml-auto flex min-w-0 items-center">{identity}</div>
          ) : null}
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}

/** Shared by the static rail and the mobile Sheet, so they cannot drift. */
function SidebarBody({
  section,
  onSectionChange,
}: {
  section: PortalSection
  onSectionChange: (section: PortalSection) => void
}) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center">
        <Image
          src="/icon.svg"
          alt="Zentra"
          width={24}
          height={24}
          className="mr-2 size-6 shrink-0"
        />
        <span className="text-lg font-semibold">Zentra Account</span>
      </div>

      <nav aria-label="Sections" className="mt-8 space-y-3">
        <span className="text-sm font-medium">Your account</span>
        <div className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = item.id === section
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                aria-current={active ? 'page' : undefined}
                // Same idle/hover/active vocabulary as the calendar's settings
                // nav and meet's rail.
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className="[&_svg]:size-4">{item.icon}</span>
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
