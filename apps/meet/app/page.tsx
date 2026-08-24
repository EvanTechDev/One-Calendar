import Link from 'next/link'
import { getServerSession } from '@/lib/auth/server'
import { HomeActions } from '@/components/home-actions'
import { Dashboard } from '@/components/dashboard/dashboard'
import { Button } from '@zntr/ui/button'

export default async function HomePage() {
  const session = await getServerSession()

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">
            M
          </div>
          <span className="text-sm font-medium">Zentra Meet</span>
        </div>
        {session ? (
          <span className="text-sm text-muted-foreground">
            {session.user.name}
          </span>
        ) : (
          <Button asChild size="sm" variant="ghost">
            <Link href={signInUrl()}>Sign in</Link>
          </Button>
        )}
      </header>

      {session ? (
        <Dashboard userId={session.user.id} />
      ) : (
        <section className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-md space-y-8">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-semibold tracking-tight">
                Meetings for your calendar
              </h1>
              <p className="text-muted-foreground">
                Start an instant meeting or join with a code. No downloads
                required.
              </p>
            </div>
            <HomeActions />
          </div>
        </section>
      )}

      <footer className="px-6 py-4 text-center text-xs text-muted-foreground">
        Part of the Zentra suite
      </footer>
    </main>
  )
}

/** Sign-in lives in the calendar app; meet only reads the session. */
function signInUrl(): string {
  const origin = process.env.NEXT_PUBLIC_CALENDAR_ORIGIN ?? ''
  return `${origin.replace(/\/$/, '')}/sign-in`
}
