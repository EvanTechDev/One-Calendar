'use client'

import { useState } from 'react'
import { CalendarClock, History, Home, Menu } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@zntr/ui/sheet'
import { cn } from '@zntr/utils'
import { ZentraMark } from '@/components/shell/zentra-mark'

/**
 * The signed-in Shell for meet, mirroring the calendar's `/app`: a `w-[247px]`
 * bordered rail beside a main column with an `h-16` bordered header, all on one
 * shared `bg-background`.
 *
 * Seams, not floating Panels — the calendar's shell tells its regions apart
 * with borders on a single background, and a rounded panel here would read as a
 * different product. There is no reusable shell in packages/ui, so this is
 * meet's own; if a third app ever needs one, this is the file to lift.
 */

export type MeetSection = 'home' | 'upcoming' | 'history'

const NAV: { id: MeetSection; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <Home /> },
  { id: 'upcoming', label: 'Upcoming', icon: <CalendarClock /> },
  { id: 'history', label: 'Your meetings', icon: <History /> },
]

interface MeetShellProps {
  section: MeetSection
  onSectionChange: (section: MeetSection) => void
  /**
   * Rendered in the sidebar under the brand. Opens the New meeting dialog —
   * this button no longer starts a meeting directly, so `newMeetingPending`
   * only applies to a host that still does (none today).
   */
  onNewMeeting: () => void
  newMeetingPending?: boolean
  /** Shown at the right of the header. */
  identity?: React.ReactNode
  children: React.ReactNode
}

export function MeetShell({
  section,
  onSectionChange,
  onNewMeeting,
  newMeetingPending,
  identity,
  children,
}: MeetShellProps) {
  const [navOpen, setNavOpen] = useState(false)
  const title = NAV.find((item) => item.id === section)?.label ?? 'Meet'

  return (
    <div className="relative flex h-dvh overflow-hidden bg-background">
      {/* The static rail. The calendar has no mobile shell to copy, so below
          `sm` this is replaced by the Sheet below — `sm` (640px) being the
          repo's convention (settings-dialog.tsx). */}
      <aside className="hidden w-[247px] shrink-0 overflow-y-auto border-r bg-background sm:flex sm:flex-col">
        <SidebarBody
          section={section}
          onSectionChange={onSectionChange}
          onNewMeeting={onNewMeeting}
          newMeetingPending={newMeetingPending}
        />
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
                onNewMeeting={() => {
                  setNavOpen(false)
                  onNewMeeting()
                }}
                newMeetingPending={newMeetingPending}
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
  onNewMeeting,
  newMeetingPending,
}: {
  section: MeetSection
  onSectionChange: (section: MeetSection) => void
  onNewMeeting: () => void
  newMeetingPending?: boolean
}) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center">
        {/* Decorative: the brand name sits beside it. */}
        <ZentraMark decorative className="mr-2 size-6 shrink-0" />
        <span className="text-lg font-semibold">Zentra Meet</span>
      </div>

      {/* No icon: the maintainer's call. It is the only button in the rail, so
          it needs no glyph to be found, and the nav items below it are the
          icon-bearing things. */}
      <Button
        className="mb-4 h-10 w-full justify-center"
        variant="secondary"
        onClick={onNewMeeting}
        disabled={newMeetingPending}
      >
        {newMeetingPending ? 'Starting…' : 'New meeting'}
      </Button>

      <nav aria-label="Sections" className="mt-8 space-y-3">
        <span className="text-sm font-medium">Meetings</span>
        <div className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = item.id === section
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                aria-current={active ? 'page' : undefined}
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
