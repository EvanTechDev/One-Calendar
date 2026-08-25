'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@zntr/ui/dialog'
import { HomeActions } from '@/components/home-actions'

/**
 * The sidebar's "New meeting" action, as a dialog.
 *
 * Home no longer hosts start/join: with Upcoming and Your-meetings as their own
 * sections, a permanently-mounted form was the largest thing on a page whose
 * job is orientation. The action is one click from every section here instead
 * of only from home.
 *
 * The body is `HomeActions` verbatim — the same hook that stores a guest
 * Organiser's Creator Token before navigating (ADR 0016) and the same parser
 * that keeps a pasted link's E2EE hash intact.
 */
export function NewMeetingDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New meeting</DialogTitle>
          <DialogDescription>
            Open a meeting now, or enter a code you were given.
          </DialogDescription>
        </DialogHeader>
        <HomeActions
          idPrefix="new-meeting"
          onNavigate={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
