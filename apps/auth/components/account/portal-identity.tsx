'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@zntr/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'
import type { PortalUser } from '@/components/account/account-sections'

/**
 * The header avatar, same shape as the calendar's and meet's.
 *
 * A dropdown rather than a direct link, unlike meet's: meet's avatar opens
 * settings because settings are elsewhere, but here the user is already in
 * settings — so the only thing the avatar has left to offer is sign-out.
 */
export function PortalIdentity({ user }: { user: PortalUser }) {
  const router = useRouter()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 overflow-hidden rounded-full p-0"
          aria-label="Your account"
        >
          <img
            src={user.image || '/user.png'}
            alt="avatar"
            width={32}
            height={32}
            className="rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut()
            // `refresh` rather than `push`: the session is read server-side, so
            // the signed-out view only appears once the request re-runs without
            // the cookie.
            router.refresh()
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
