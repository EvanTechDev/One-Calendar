'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  useLiveAnchorRect,
  pickPopoverSide,
  buildAnchorStyle,
} from '@/hooks/use-anchored-popover'
import {
  Edit2,
  Trash2,
  X,
  MapPin,
  Users,
  Calendar,
  Bell,
  AlignLeft,
  ChevronDown,
  Bookmark,
  MoreHorizontal,
  Send,
  UserMinus,
  Repeat,
  ClipboardCopy,
  Video,
} from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Badge } from '@zntr/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@zntr/ui/avatar'
import { ButtonGroup } from '@zntr/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@zntr/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zntr/ui/select'
import { zhCN, enUS } from 'date-fns/locale'
import { format } from 'date-fns'
import type { CalendarEvent } from '../calendar'
import type { Language } from '@zntr/i18n/calendar'
import { isZhLanguage, translations } from '@zntr/i18n/calendar'
import { cn } from '@zntr/utils'
import { useCalendar } from '@/components/providers/calendar-context'
import { useBookmarks } from '@/components/providers/data-provider'
import { Popover, PopoverAnchor, PopoverContent } from '@zntr/ui/popover'
import { RemoveScroll } from 'react-remove-scroll'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth/client'
import { describeRecurrence } from '@/lib/recurrence/engine'
import { TAILWIND_BG_TO_HEX } from '@/lib/event-colors'
import {
  MeetingLinkControls,
  meetingLookupId,
  useEventMeeting,
} from '@/components/app/event/event-meeting-link'
import { useMeetingTiming } from '@/hooks/use-meeting-timing'
import { isJoinUrgent } from '@/lib/meeting-timing'

export interface EventInvite {
  id: string
  email: string
  status: 'pending' | 'accepted' | 'maybe' | 'declined'
  inviteToken: string
  emailSent: boolean
  addedToCalendar: boolean
  userName: string | null
  userImage: string | null
  /**
   * The emailed link died before the participant joined; "Resend Invite"
   * mints a fresh one (ADR-0013). Optional because older payloads may omit it.
   */
  inviteExpired?: boolean
}

function CategoryDot({ color }: { color?: string }) {
  // Category colours are stored as Tailwind class names ('bg-blue-500'), not
  // CSS colours — passing one to backgroundColor is silently invalid and
  // every dot rendered gray. Translate through the shared map; accept a raw
  // CSS colour as-is for callers that already resolved one.
  const resolved = color
    ? (TAILWIND_BG_TO_HEX[color] ?? (color.startsWith('bg-') ? null : color))
    : null
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: resolved || 'var(--muted-foreground)' }}
    />
  )
}

interface EventPreviewProps {
  event: CalendarEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  _onDuplicate: () => void
  language: Language
  _timezone: string
  anchorRect?: DOMRect | null
  anchorElement?: HTMLElement | null
  scrollContainerRef?: React.RefObject<HTMLElement | null>
  onInvitesChange?: (eventId: string, invites: EventInvite[]) => void
  onCategoryChange?: (eventId: string, calendarId: string | null) => void
}

export default function EventPreview({
  event,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  _onDuplicate,
  language,
  _timezone,
  anchorRect = null,
  anchorElement,
  scrollContainerRef,
  onInvitesChange,
  onCategoryChange,
}: EventPreviewProps) {
  const { calendars, events } = useCalendar()
  const isZh = isZhLanguage(language)
  const _t = translations[language]
  const locale = isZh ? zhCN : enUS
  const [participantsOpen, setParticipantsOpen] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [invites, setInvites] = useState<EventInvite[]>(event?.invites ?? [])
  const { data: session } = authClient.useSession()
  const _isSignedIn = Boolean(session?.user)
  const { bookmarks, createBookmark, deleteBookmark } = useBookmarks()
  const ignoreOutsideUntilRef = useRef(0)
  const colorMapping: Record<string, string> = {
    'bg-[#E6F6FD]': '#3B82F6',
    'bg-[#E7F8F2]': '#10B981',
    'bg-[#FEF5E6]': '#F59E0B',
    'bg-[#FFE4E6]': '#EF4444',
    'bg-[#F3EEFE]': '#8B5CF6',
    'bg-[#FCE7F3]': '#EC4899',
    'bg-[#EEF2FF]': '#6366F1',
    'bg-[#FFF0E5]': '#FB923C',
    'bg-[#E6FAF7]': '#14B8A6',
  }

  useEffect(() => {
    if (open) {
      ignoreOutsideUntilRef.current = Date.now() + 150
    }
  }, [open])

  const invitesRef = useRef<EventInvite[]>([])
  useEffect(() => {
    invitesRef.current = invites
  }, [invites])

  // Anchor resolution shared with the event editor, so the two popovers
  // position identically (CORE-191).
  const effectiveAnchorRect = useLiveAnchorRect({
    open,
    anchorElement,
    anchorSelector: event ? `[data-event-id="${CSS.escape(event.id)}"]` : null,
    anchorRect,
    scrollContainerRef,
  })

  const isSameInvites = (a: EventInvite[], b: EventInvite[]) =>
    a.length === b.length &&
    a.every((invite, index) => {
      const other = b[index]
      return (
        other &&
        invite.id === other.id &&
        invite.status === other.status &&
        invite.emailSent === other.emailSent &&
        invite.addedToCalendar === other.addedToCalendar
      )
    })

  useEffect(() => {
    if (!open || !event || event.viewOnly) return

    let cancelled = false
    const pollInvites = async () => {
      try {
        const response = await fetch(
          `/api/invites?eventId=${encodeURIComponent(event.id)}`,
        )
        if (!response.ok || cancelled) return
        const data = await response.json()
        const next = data?.invites
        if (!Array.isArray(next) || cancelled) return
        const changed = !isSameInvites(invitesRef.current, next)
        setInvites((prev) => (isSameInvites(prev, next) ? prev : next))
        if (changed) onInvitesChange?.(event.id, next)
      } catch {}
    }

    const timerId = window.setInterval(pollInvites, 15000)
    return () => {
      cancelled = true
      window.clearInterval(timerId)
    }
  }, [open, event, onInvitesChange])

  useEffect(() => {
    if (event) {
      const isCurrentEventBookmarked = bookmarks.some(
        (bookmark: any) => bookmark.eventId === event.id,
      )
      setIsBookmarked(isCurrentEventBookmarked)
    }
  }, [event, bookmarks])

  useEffect(() => {
    if (event) {
      setInvites(event.invites ?? [])
    }
  }, [event])

  // An attached Meeting was previously invisible here: the organiser added it
  // in the editor and then saw nothing when clicking the event. Resolved by
  // lookup rather than from a column on the event (ADR-0019), keyed on the
  // series master because an expanded occurrence's id is synthetic. Skipped
  // for a participant's copy, which cannot own the lookup.
  const timing = useMeetingTiming(open && event ? event : null)
  const [meeting] = useEventMeeting(
    open && event ? meetingLookupId(event) : null,
    !event?.viewOnly,
  )

  if (!event || !open) return null

  const getCalendarName = () => {
    if (!event) return ''
    const calendar = calendars.find((cal) => cal.id === event.calendarId)
    return calendar ? calendar.name : ''
  }

  const formatDateRange = () => {
    const startDate = new Date(event.startDate)
    const endDate = new Date(event.endDate)
    const dateFormat = 'yyyy-MM-dd HH:mm'
    const startFormatted = format(startDate, dateFormat, { locale })
    const endFormatted = format(endDate, dateFormat, { locale })
    return `${startFormatted} – ${endFormatted}`
  }

  const formatNotificationTime = () => {
    if (event.notification === null || event.notification === undefined) {
      return _t.noReminder
    }
    if (event.notification === 0) return _t.atEventTime
    if (event.notification % 60 === 0) {
      return _t.hourBefore.replace('{hours}', String(event.notification / 60))
    }
    return _t.minutesBefore.replace('{minutes}', String(event.notification))
  }

  const seriesMaster = event.seriesId
    ? events.find((e) => e.id === event.seriesId)
    : undefined
  const recurrenceSummary = event.rrule
    ? describeRecurrence(event.rrule, isZh)
    : seriesMaster?.rrule
      ? describeRecurrence(seriesMaster.rrule, isZh)
      : null

  const _getInitials = (name: string) => name.charAt(0).toUpperCase()

  const _hasParticipants =
    event.participants &&
    event.participants.length > 0 &&
    event.participants.some((p) => p.trim() !== '')

  const toggleParticipants = () => setParticipantsOpen(!participantsOpen)

  const isRecurring = !!event?.rrule || !!event?.seriesId
  /**
   * Mirrors the event dialog's `canAllScope`: "all events" is only offered on
   * the series' first occurrence. A raw master row IS the series root, so "all"
   * stays allowed there.
   */
  const isRawMasterTarget =
    !!event?.rrule && !event?.seriesId && !event?.recurrenceId
  const canAllScope =
    !!event && (isRawMasterTarget || event.isFirstInstance === true)

  const toggleBookmark = async () => {
    if (!event) return
    if (isBookmarked) {
      const bm = bookmarks.find((b: any) => b.eventId === event.id)
      if (bm) {
        await deleteBookmark(bm.id)
      }
      setIsBookmarked(false)
      toast(isZh ? '已取消收藏' : 'Removed from bookmarks', {
        description: isZh
          ? '事件已从收藏夹中移除'
          : 'Event has been removed from your bookmarks',
      })
    } else {
      await createBookmark({ eventId: event.id })
      setIsBookmarked(true)
      toast(isZh ? '已收藏' : 'Bookmarked', {
        description: isZh
          ? '事件已添加到收藏夹'
          : 'Event has been added to your bookmarks',
      })
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete()
  }

  const handleResendInvite = async (inviteId: string) => {
    if (!event) return
    try {
      await fetch('/api/invites/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      })
      toast.success('Invitation sent')
    } catch {
      toast.error('Failed to send invitation')
    }
  }

  /**
   * Removes a participant from the chosen occurrences.
   *
   * For a recurring event the scope follows the same rule as an event edit:
   * `all` only on the series' first occurrence, `following` elsewhere. See
   * ADR-0007 (participant scope follows the same rules as event scope).
   */
  const handleRemoveParticipant = async (
    inviteId: string,
    scope: 'single' | 'following' | 'all' = 'all',
  ) => {
    if (!event) return
    try {
      const params = new URLSearchParams({ id: inviteId, scope })
      if (isRecurring) params.set('occurrenceId', event.id)
      const response = await fetch(`/api/invites/manage?${params}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const message = await response
          .json()
          .then((d) => d?.error)
          .catch(() => null)
        throw new Error(message ?? 'failed')
      }
      // Correct for every scope here: the participant is gone from the
      // occurrence being viewed, which is what this list shows. The 15-second
      // poll reconciles the grant's remaining occurrences.
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
      toast.success('Participant removed')
    } catch (error) {
      toast.error(
        error instanceof Error && error.message !== 'failed'
          ? error.message
          : 'Failed to remove participant',
      )
    }
  }

  /**
   * Copies a participant's own invite link so the organiser can share it
   * directly (e.g. over chat) instead of relying on the invite email. The
   * token is per-participant, so each row copies a distinct link.
   */
  const handleCopyInviteLink = async (inviteToken: string) => {
    const url = `${window.location.origin}/invite/${inviteToken}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success(_t.inviteLinkCopied)
    } catch {
      // Clipboard access can be denied (insecure context, permission policy).
      toast.error('Failed to copy invite link')
    }
  }

  const handleViewOnlyRsvp = async (
    newStatus: 'accepted' | 'maybe' | 'declined',
  ) => {
    if (!event) return
    const dbInvite = invites.find(
      (i) => i.email === session?.user?.email?.toLowerCase(),
    )
    if (!dbInvite) return
    try {
      // Each occurrence of a recurring event carries its own answer, so the
      // stamp is required. Omitting it wrote the invite-level status instead —
      // which the calendar never reads — so the answer appeared to do nothing
      // and every occurrence stayed "pending".
      //
      // The session endpoint, not the token one: the emailed link expires but
      // the grant does not, so answering from the calendar must keep working
      // after the link dies (ADR-0013).
      const response = await fetch('/api/invites/self', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteToken: dbInvite.inviteToken,
          status: newStatus,
          ...(event.recurrenceId ? { recurrenceId: event.recurrenceId } : {}),
        }),
      })
      if (!response.ok) {
        const message = await response
          .json()
          .then((d) => d?.error)
          .catch(() => null)
        throw new Error(message ?? 'failed')
      }
      setInvites((prev) =>
        prev.map((i) =>
          i.id === dbInvite.id ? { ...i, status: newStatus } : i,
        ),
      )
    } catch (error) {
      toast.error(
        error instanceof Error && error.message !== 'failed'
          ? error.message
          : 'Failed to update RSVP',
      )
    }
  }

  const userInvite = invites.find(
    (i) => i.email === session?.user?.email?.toLowerCase(),
  )

  const organizerInfo = event.viewOnly
    ? (event.organizer ?? null)
    : session?.user
      ? {
          name: session.user.name || '',
          email: session.user.email || '',
          image: session.user.image ?? null,
        }
      : null

  const handleViewOnlyCategoryChange = async (calendarId: string) => {
    if (!event || !userInvite) return
    const value = calendarId === '__uncategorized__' ? null : calendarId
    try {
      // Session-authenticated: the invite link may have expired by now, but
      // the grant persists (ADR-0013).
      await fetch('/api/invites/self', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteToken: userInvite.inviteToken,
          categoryId: value ?? '__uncategorized__',
        }),
      })
      onCategoryChange?.(event.id, value)
    } catch {
      toast.error(isZh ? '移动失败' : 'Failed to move event')
    }
  }

  const popoverSide = pickPopoverSide(effectiveAnchorRect, 460, 520)
  const anchorStyle = buildAnchorStyle(
    effectiveAnchorRect,
    popoverSide,
    scrollContainerRef?.current,
  )

  const anchorNode = (
    <PopoverAnchor asChild>
      <div style={anchorStyle} />
    </PopoverAnchor>
  )

  const renderedAnchor =
    effectiveAnchorRect && scrollContainerRef?.current
      ? createPortal(anchorNode, scrollContainerRef.current)
      : anchorNode

  return (
    <RemoveScroll enabled={open}>
      <Popover open={open} onOpenChange={onOpenChange} modal={false}>
        {renderedAnchor}
        <PopoverContent
          key={event.id}
          side={popoverSide}
          align="center"
          sideOffset={12}
          collisionPadding={12}
          // Same height discipline as the editor: cap at what actually fits
          // (Radix subtracts browser chrome), scroll inside.
          className="w-[min(96vw,28rem)] max-h-[min(var(--radix-popover-content-available-height),40rem)] overflow-y-auto rounded-xl p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (Date.now() < ignoreOutsideUntilRef.current) {
              e.preventDefault()
              return
            }
            const target = e.target instanceof Element ? e.target : null
            if (target?.closest('[data-event-id]')) {
              e.preventDefault()
              return
            }
            onOpenChange(false)
          }}
        >
          <div className="flex justify-between items-center p-5">
            <div className="w-24" />
            <div className="flex space-x-2 ml-auto">
              {!event.viewOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit()}
                  className="h-8 w-8"
                >
                  <Edit2 className="h-5 w-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleBookmark}
                className="h-8 w-8"
              >
                <Bookmark
                  className={cn(
                    'h-5 w-5',
                    isBookmarked ? 'fill-blue-500 text-blue-500' : '',
                  )}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDeleteClick}
                className="h-8 w-8"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 ml-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="px-5 pb-5 flex">
            <div
              className="w-2 self-stretch rounded-full mr-4"
              style={{ backgroundColor: colorMapping[event.color] }}
            />

            <div className="flex-1">
              <h2
                className="mb-1 text-2xl font-bold break-words break-all overflow-hidden [overflow-wrap:anywhere]"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {event.title}
              </h2>
              <p className="text-muted-foreground">{formatDateRange()}</p>
            </div>
          </div>

          <div className="px-5 pb-5 space-y-4">
            {event.location && event.location.trim() !== '' && (
              <div className="flex items-start">
                <MapPin className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p>{event.location}</p>
                </div>
              </div>
            )}

            {meeting && (
              <div className="flex items-start">
                <Video className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                <MeetingLinkControls
                  meeting={meeting}
                  urgent={isJoinUrgent(timing)}
                  live={timing === 'live'}
                />
              </div>
            )}

            {invites.length > 0 && (
              <div className="flex items-start">
                <Users className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={toggleParticipants}
                  >
                    <p>
                      {invites.length} {isZh ? '参与者' : 'participants'}
                    </p>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform duration-200',
                        participantsOpen ? 'transform rotate-180' : '',
                      )}
                    />
                  </div>
                  {participantsOpen && (
                    <div className="mt-2 space-y-2">
                      {organizerInfo &&
                        (organizerInfo.name || organizerInfo.email) && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center min-w-0">
                              <Avatar size="sm">
                                {organizerInfo.image ? (
                                  <AvatarImage src={organizerInfo.image} />
                                ) : null}
                                <AvatarFallback>
                                  {(
                                    organizerInfo.name ||
                                    organizerInfo.email ||
                                    '?'
                                  )
                                    .charAt(0)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="ml-2 truncate text-sm">
                                {organizerInfo.name || organizerInfo.email}
                              </span>
                              <span className="ml-1.5 shrink-0">
                                <Badge className="bg-muted text-muted-foreground">
                                  {_t.organizer}
                                </Badge>
                              </span>
                            </div>
                          </div>
                        )}
                      {invites.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center min-w-0">
                            <Avatar size="sm">
                              {invite.userImage ? (
                                <AvatarImage src={invite.userImage} />
                              ) : null}
                              <AvatarFallback>
                                {invite.email.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="ml-2 truncate text-sm">
                              {invite.userName || invite.email}
                            </span>
                            <span className="ml-1.5 shrink-0">
                              <Badge
                                variant={
                                  invite.status === 'accepted'
                                    ? 'default'
                                    : invite.status === 'declined'
                                      ? 'destructive'
                                      : invite.status === 'maybe'
                                        ? 'secondary'
                                        : 'outline'
                                }
                                className={cn(
                                  invite.status === 'accepted' &&
                                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                                  invite.status === 'pending' &&
                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                                  invite.status === 'declined' &&
                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                )}
                              >
                                {invite.status === 'accepted'
                                  ? _t.accepted
                                  : invite.status === 'declined'
                                    ? _t.declined
                                    : invite.status === 'maybe'
                                      ? _t.maybe
                                      : _t.pending}
                              </Badge>
                            </span>
                            {invite.inviteExpired ? (
                              // The link died before they joined — they cannot
                              // act until the organiser resends (ADR-0013).
                              <span className="ml-1.5 shrink-0">
                                <Badge variant="outline">
                                  {isZh ? '邀请已过期' : 'Invite expired'}
                                </Badge>
                              </span>
                            ) : null}
                          </div>
                          {!event.viewOnly && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              {/* Wider than the default 8rem: the trigger is a
                                  32px icon button, so the menu inherits its
                                  width and items like "Copy invite link" wrap. */}
                              <DropdownMenuContent
                                align="end"
                                className="min-w-52"
                              >
                                {!invite.emailSent ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleResendInvite(invite.id)
                                    }
                                  >
                                    <Send className="mr-2 h-4 w-4" />
                                    Send Invite
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleResendInvite(invite.id)
                                    }
                                  >
                                    <Send className="mr-2 h-4 w-4" />
                                    Resend Invite
                                  </DropdownMenuItem>
                                )}
                                {invite.inviteToken ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleCopyInviteLink(invite.inviteToken)
                                    }
                                  >
                                    <ClipboardCopy className="mr-2 h-4 w-4" />
                                    {_t.copyInviteLink}
                                  </DropdownMenuItem>
                                ) : null}
                                {isRecurring ? (
                                  <>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() =>
                                        handleRemoveParticipant(
                                          invite.id,
                                          'single',
                                        )
                                      }
                                    >
                                      <UserMinus className="mr-2 h-4 w-4" />
                                      {isZh
                                        ? '移除（仅此日程）'
                                        : 'Remove (this event)'}
                                    </DropdownMenuItem>
                                    {canAllScope ? (
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() =>
                                          handleRemoveParticipant(
                                            invite.id,
                                            'all',
                                          )
                                        }
                                      >
                                        <UserMinus className="mr-2 h-4 w-4" />
                                        {isZh
                                          ? '移除（所有日程）'
                                          : 'Remove (all events)'}
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() =>
                                          handleRemoveParticipant(
                                            invite.id,
                                            'following',
                                          )
                                        }
                                      >
                                        <UserMinus className="mr-2 h-4 w-4" />
                                        {isZh
                                          ? '移除（此日程及后续）'
                                          : 'Remove (this and following)'}
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                ) : (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() =>
                                      handleRemoveParticipant(invite.id, 'all')
                                    }
                                  >
                                    <UserMinus className="mr-2 h-4 w-4" />
                                    Remove
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {(getCalendarName() || (event.viewOnly && userInvite)) && (
              <div className="flex items-start">
                <Calendar className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  {event.viewOnly && userInvite ? (
                    <Select
                      value={event.calendarId || '__uncategorized__'}
                      onValueChange={handleViewOnlyCategoryChange}
                    >
                      {/* A stock trigger on purpose: default size, natural
                          width. The colour dot before the name carries the
                          category colour. */}
                      <SelectTrigger aria-label={_t.selectCalendar}>
                        <SelectValue placeholder={_t.selectCalendar}>
                          <span className="inline-flex items-center gap-1.5">
                            <CategoryDot
                              color={
                                calendars.find(
                                  (cal) => cal.id === event.calendarId,
                                )?.color
                              }
                            />
                            {getCalendarName() || _t.uncategorized}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="__uncategorized__">
                          <span className="inline-flex items-center gap-2">
                            <CategoryDot />
                            {_t.uncategorized}
                          </span>
                        </SelectItem>
                        {calendars.map((calendar) => (
                          <SelectItem key={calendar.id} value={calendar.id}>
                            <span className="inline-flex items-center gap-2">
                              <CategoryDot color={calendar.color} />
                              {calendar.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p>{getCalendarName()}</p>
                  )}
                </div>
              </div>
            )}

            {recurrenceSummary && (
              <div className="flex items-start">
                <Repeat className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p>{recurrenceSummary}</p>
                </div>
              </div>
            )}

            {event.notification !== null &&
              event.notification !== undefined && (
                <div className="flex items-start">
                  <Bell className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p>{formatNotificationTime()}</p>
                    {/* Shown only when it is actually true — the old copy
                        claimed email unconditionally and no email existed. */}
                    {event.emailReminder === true && (
                      <p className="text-sm text-muted-foreground">
                        {_t.emailReminder}
                      </p>
                    )}
                  </div>
                </div>
              )}

            {event.description && event.description.trim() !== '' && (
              <div className="flex items-start">
                <AlignLeft className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p
                    className="whitespace-pre-wrap break-words break-all overflow-hidden [overflow-wrap:anywhere]"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {event.description}
                  </p>
                </div>
              </div>
            )}

            {event.viewOnly && userInvite && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {isZh ? '您的回复' : 'Your response'}
                </p>
                {/*
                  Each occurrence is answered independently, so say which one
                  this is. Without it the buttons look like they set a single
                  answer for the whole series.
                */}
                {isRecurring && (
                  <p className="text-xs text-muted-foreground">
                    {isZh ? '仅适用于此日期' : 'Applies to this date only'}
                  </p>
                )}
                <ButtonGroup orientation="horizontal">
                  <Button
                    variant={
                      userInvite.status === 'accepted' ? 'default' : 'outline'
                    }
                    onClick={() => handleViewOnlyRsvp('accepted')}
                  >
                    Yes
                  </Button>
                  <Button
                    variant={
                      userInvite.status === 'maybe' ? 'default' : 'outline'
                    }
                    onClick={() => handleViewOnlyRsvp('maybe')}
                  >
                    Maybe
                  </Button>
                  <Button
                    variant={
                      userInvite.status === 'declined' ? 'default' : 'outline'
                    }
                    onClick={() => handleViewOnlyRsvp('declined')}
                  >
                    No
                  </Button>
                </ButtonGroup>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </RemoveScroll>
  )
}
