import Link from 'next/link'
import { getServerSession } from '@/lib/auth/server'
import { HomeActions } from '@/components/home-actions'
import { Dashboard } from '@/components/dashboard/dashboard'
import { UserAvatarButton } from '@/components/dashboard/user-avatar-button'
import { ZentraMark } from '@/components/shell/zentra-mark'
import { Button } from '@zntr/ui/button'

export default async function HomePage() {
  const session = await getServerSession()

  // A signed-in user gets the Shell, which owns its own header and brand
  // block; a guest keeps the simple centred column, which has no sections to
  // navigate and no history to show.
  if (session) {
    return (
      <Dashboard
        calendarOrigin={calendarOrigin()}
        userName={session.user.name}
        identity={
          <UserAvatarButton
            user={{
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
              image: session.user.image,
            }}
          />
        }
      />
    )
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <ZentraMark className="size-6 shrink-0 brightness-0 dark:invert" />
          <span className="text-sm font-medium">Zentra Meet</span>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild size="sm" variant="ghost">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Sign up</Link>
          </Button>
        </div>
      </header>

      {/*
        Start and join stay INLINE for a guest. They moved into a dialog for
        signed-in users because the sidebar's "New meeting" button opens it — a
        guest has no sidebar, so a dialog here would have no trigger.
      */}
      <section className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              Meetings for your calendar
            </h1>
            <p className="text-muted-foreground">
              Start an instant meeting or join with a code. No downloads
              required.
            </p>
          </div>
          <HomeActions idPrefix="guest" />
          {/*
            A session cookie issued before AUTH_COOKIE_DOMAIN was configured
            is host-only to the calendar and never reaches this app, so a
            signed-in user lands here looking anonymous. Nothing about that is
            guessable from the UI, hence the hint.
          */}
          <p className="text-center text-xs text-muted-foreground">
            Already signed in on Zentra Calendar and still seeing this? Sign out
            there and back in once, then reload.
          </p>
        </div>
      </section>

      <footer className="px-6 py-4 text-center text-xs text-muted-foreground">
        Part of the Zentra suite
      </footer>
    </main>
  )
}

/**
 * The calendar's origin, for reading data it owns — not for navigation.
 *
 * Sign-in used to be built from this: meet had no auth pages, so a signed-out
 * visitor was sent to the calendar with a return URL. It has its own pages now
 * (ADR 0022) and links to them relatively, which also means the flow no longer
 * depends on a build-time variable being present.
 *
 * Upcoming meetings are still read from the calendar, because it owns recurrence
 * expansion (ADR 0017).
 */
function calendarOrigin(): string {
  return (process.env.NEXT_PUBLIC_CALENDAR_ORIGIN ?? '').replace(/\/$/, '')
}
