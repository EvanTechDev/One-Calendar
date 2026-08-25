import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { Button } from '@zntr/ui/button'

/**
 * Room codes are `xxxx-xxxx`, and `/[code]` calls `notFound()` for anything
 * else — a mistyped or truncated link. Without this the framework's default
 * 404 appeared, which looks nothing like the rest of the app and offers no way
 * back to joining a meeting.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <SearchX className="size-5 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            Check the meeting code, or start a new meeting from home.
          </p>
        </div>
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  )
}
