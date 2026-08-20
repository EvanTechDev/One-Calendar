'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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

export interface EventInvite {
  id: string
  email: string
  status: 'pending' | 'accepted' | 'maybe' | 'declined'
  inviteToken: string
  emailSent: boolean
  addedToCalendar: boolean
  userName: string | null
  userImage: string | null
}

function CategoryDot({ color }: { color?: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color || 'var(--muted-foreground)' }}
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

  const [liveRect, setLiveRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!open) return

    const getLiveAnchorRect = (): DOMRect | null => {
      const el =
        anchorElement && anchorElement.isConnected
          ? anchorElement
          : event
            ? document.querySelector(
                `[data-event-id="${CSS.escape(event.id)}"]`,
              )
            : null
      if (el) return el.getBoundingClientRect()
      return anchorRect
    }

    const update = () => {
      const next = getLiveAnchorRect()
      setLiveRect((prev) => {
        if (
          prev &&
          next &&
          prev.left === next.left &&
          prev.top === next.top &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev
        }
        return next
      })
    }
    update()

    const container = scrollContainerRef?.current
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    container?.addEventListener('scroll', update, true)

    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      container?.removeEventListener('scroll', update, true)
    }
  }, [open, anchorElement, anchorRect, event, scrollContainerRef])

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
    if (event.notification === 0)
      return isZh ? '事件开始时' : 'At time of event'
    return isZh
      ? `${event.notification} 分钟前`
      : `${event.notification} minutes before`
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

  const handleRemoveParticipant = async (inviteId: string) => {
    if (!event) return
    try {
      await fetch(`/api/invites/manage?id=${inviteId}`, {
        method: 'DELETE',
      })
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
      toast.success('Participant removed')
    } catch {
      toast.error('Failed to remove participant')
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
      await fetch(`/api/invite/${dbInvite.inviteToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      setInvites((prev) =>
        prev.map((i) =>
          i.id === dbInvite.id ? { ...i, status: newStatus } : i,
        ),
      )
    } catch {
      toast.error('Failed to update RSVP')
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
      await fetch(`/api/invite/${userInvite.inviteToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: value ?? '__uncategorized__' }),
      })
      onCategoryChange?.(event.id, value)
    } catch {
      toast.error(isZh ? '移动失败' : 'Failed to move event')
    }
  }

  const effectiveAnchorRect = liveRect ?? anchorRect

  const popoverSide: 'top' | 'right' | 'bottom' | 'left' = effectiveAnchorRect
    ? (() => {
        const viewportWidth =
          typeof window === 'undefined' ? 0 : window.innerWidth
        const viewportHeight =
          typeof window === 'undefined' ? 0 : window.innerHeight
        const spaces = {
          top: effectiveAnchorRect.top,
          right: viewportWidth - effectiveAnchorRect.right,
          bottom: viewportHeight - effectiveAnchorRect.bottom,
          left: effectiveAnchorRect.left,
        }
        const estimatedWidth = 460
        const estimatedHeight = 520
        if (spaces.right >= estimatedWidth) return 'right'
        if (spaces.left >= estimatedWidth) return 'left'
        if (spaces.bottom >= estimatedHeight) return 'bottom'
        if (spaces.top >= estimatedHeight) return 'top'
        const entries = Object.entries(spaces) as Array<
          ['top' | 'right' | 'bottom' | 'left', number]
        >
        return entries.sort((a, b) => b[1] - a[1])[0][0]
      })()
    : 'bottom'

  const anchorStyle: React.CSSProperties = (() => {
    if (effectiveAnchorRect && scrollContainerRef?.current) {
      const containerRect = scrollContainerRef.current.getBoundingClientRect()
      const midX = effectiveAnchorRect.left + effectiveAnchorRect.width / 2
      const midY = effectiveAnchorRect.top + effectiveAnchorRect.height / 2
      const edgePoint =
        popoverSide === 'right'
          ? { left: effectiveAnchorRect.right, top: midY }
          : popoverSide === 'left'
            ? { left: effectiveAnchorRect.left, top: midY }
            : popoverSide === 'top'
              ? { left: midX, top: effectiveAnchorRect.top }
              : { left: midX, top: effectiveAnchorRect.bottom }
      return {
        position: 'absolute',
        left:
          edgePoint.left -
          containerRect.left +
          scrollContainerRef.current.scrollLeft,
        top:
          edgePoint.top -
          containerRect.top +
          scrollContainerRef.current.scrollTop,
        width: 1,
        height: 1,
        pointerEvents: 'none',
      }
    }

    return {
      position: 'fixed',
      left:
        typeof window === 'undefined' ? 0 : Math.round(window.innerWidth / 2),
      top:
        typeof window === 'undefined' ? 0 : Math.round(window.innerHeight / 2),
      width: 1,
      height: 1,
      pointerEvents: 'none',
    }
  })()

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
          className="w-[min(96vw,28rem)] rounded-xl p-0 overflow-hidden"
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
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() =>
                                    handleRemoveParticipant(invite.id)
                                  }
                                >
                                  <UserMinus className="mr-2 h-4 w-4" />
                                  Remove
                                </DropdownMenuItem>
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
                      <SelectTrigger className="h-7 gap-1.5 rounded-md border-0 bg-transparent p-0 pr-1 text-sm shadow-none cursor-pointer hover:bg-muted/60 focus-visible:ring-1">
                        <SelectValue>
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

            {event.notification > 0 && (
              <div className="flex items-start">
                <Bell className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p>{formatNotificationTime()}</p>
                  <p className="text-sm text-muted-foreground">
                    {isZh
                      ? `${event.notification} 分钟前 按电子邮件`
                      : `${event.notification} minutes before by email`}
                  </p>
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
