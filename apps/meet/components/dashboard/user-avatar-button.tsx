'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@zntr/ui/button'
import { authClient } from '@/lib/auth/client'
import { SettingsDialog } from '@/components/dashboard/settings-dialog'
import type { SettingsUser } from '@/components/dashboard/settings-dialog'

/**
 * The header identity: a circular avatar that opens Settings directly.
 *
 * Directly, not via a dropdown — the maintainer's call, and there is nothing
 * else meet could put in a menu. Sign-out lives inside the dialog's Account
 * tab, which is where a two-item dropdown would have sent the user anyway;
 * the calendar's dropdown exists because it also routes to analytics, which
 * meet has none of.
 *
 * The trigger's classes are the calendar's (user-profile-button.tsx) verbatim so
 * the two apps' headers are the same object.
 */
export function UserAvatarButton({
  user,
  portalOrigin,
}: {
  user: SettingsUser
  portalOrigin: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
      // Refresh rather than push: the session is read on the server, so the
      // guest page only appears once this request re-runs with the cookie gone.
      router.refresh()
      setOpen(false)
    } catch {
      toast.error('Could not sign you out')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full overflow-hidden h-8 w-8 p-0"
        aria-label="Settings"
        onClick={() => setOpen(true)}
      >
        {/* `/user.png` did not exist in apps/meet/public until this change —
            only in the calendar's. A 404 here would have shown the browser's
            broken-image glyph in the header for every user without an avatar. */}
        <img
          src={user.image || '/user.png'}
          alt="avatar"
          width={32}
          height={32}
          className="rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      </Button>
      <SettingsDialog
        open={open}
        onOpenChange={setOpen}
        user={user}
        portalOrigin={portalOrigin}
        onSignOut={signOut}
        signingOut={signingOut}
      />
    </>
  )
}
