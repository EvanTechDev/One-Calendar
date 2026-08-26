import Link from 'next/link'
import { Button } from '@zntr/ui/button'

/**
 * The portal's root.
 *
 * Not a landing page: nobody arrives here on purpose. A user reaching this URL
 * has either finished a flow, bookmarked it, or been redirected without a
 * client — so it says where they are and offers the one thing they might want,
 * their account.
 */
export default function PortalHome() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Zentra Account
          </h1>
          <p className="text-sm text-muted-foreground">
            One account for Zentra Calendar and Zentra Meet.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </main>
  )
}
