'use client'

import { useState } from 'react'
import { Button } from '@zntr/ui/button'
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
export function UserAvatarButton({ user }: { user: SettingsUser }) {
  const [open, setOpen] = useState(false)

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
      {/* Sign-out lives in the panel's Account tab now, so this component no
          longer owns one — the shared panel signs out and navigates itself. */}
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
