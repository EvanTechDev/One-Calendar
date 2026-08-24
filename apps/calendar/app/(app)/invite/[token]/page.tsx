'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import {
  MapPin,
  AlignLeft,
  Calendar,
  XCircle,
  Repeat,
  Video,
} from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Spinner } from '@zntr/ui/spinner'
import { Avatar, AvatarImage, AvatarFallback } from '@zntr/ui/avatar'
import { Card, CardContent, CardFooter } from '@zntr/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@zntr/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zntr/ui/select'
import { getEventAccentColor } from '@/lib/event-colors'

interface InviteData {
  invite: {
    id: string
    email: string
    status: 'pending' | 'accepted' | 'maybe' | 'declined'
    addedToCalendar: boolean
  }
  event: {
    id: string
    title: string
    description: string | null
    location: string | null
    startDate: string
    endDate: string
    isAllDay: boolean
    color: string | null
    /**
     * Human-readable recurrence, e.g. "Every day". Deliberately not the rrule —
     * see ADR-0006 (participants never receive the recurrence rule).
     */
    recurrenceSummary: string | null
    /** Join link for the attached Zentra Meet room, when there is one. */
    meetingUrl: string | null
  }
  /** The occurrences this link grants, each with its own RSVP. Null if not recurring. */
  occurrences:
    | {
        recurrenceId: string
        startDate: string
        endDate: string
        status: 'pending' | 'accepted' | 'maybe' | 'declined'
      }[]
    | null
  inviter: {
    name: string
    image?: string | null
  }
  isRegisteredUser: boolean
  categories: {
    id: string
    name: string
    color: string
  }[]
}

interface Category {
  id: string
  name: string
  color: string
}

export default function InvitePage() {
  const params = useParams()
  const token = params.token as string
  const [data, setData] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<string>('pending')
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState('__uncategorized__')
  const [isRegisteredUser, setIsRegisteredUser] = useState(false)
  const [addedToCalendar, setAddedToCalendar] = useState(false)
  /**
   * RSVP per occurrence, keyed by stamp. Two occurrences of one series never
   * share an answer, so this cannot collapse into `status`.
   */
  const [occurrenceStatus, setOccurrenceStatus] = useState<
    Record<string, string>
  >({})
  const [selectedOccurrence, setSelectedOccurrence] = useState<string | null>(
    null,
  )
  const [rsvpError, setRsvpError] = useState('')
  const [addError, setAddError] = useState('')

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('Invite not found')
        return res.json()
      })
      .then((data: InviteData) => {
        setData(data)
        setStatus(data.invite.status)
        setAddedToCalendar(data.invite.addedToCalendar)
        setCategories(data.categories ?? [])
        setIsRegisteredUser(data.isRegisteredUser)
        if (data.occurrences && data.occurrences.length > 0) {
          setOccurrenceStatus(
            Object.fromEntries(
              data.occurrences.map((o) => [o.recurrenceId, o.status]),
            ),
          )
          // The first occurrence at or after now, falling back to the last.
          // Defaulting to occurrences[0] pointed at a date up to two years
          // past, so the default action answered one that had already gone.
          const now = Date.now()
          const upcoming = data.occurrences.find(
            (o) => new Date(o.startDate).getTime() >= now,
          )
          setSelectedOccurrence(
            (upcoming ?? data.occurrences[data.occurrences.length - 1])
              .recurrenceId,
          )
        }
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [token])

  const handleRsvp = async (newStatus: 'accepted' | 'maybe' | 'declined') => {
    // A recurring event is answered per occurrence; sending no stamp would
    // write one shared answer for every occurrence.
    const recurrenceId = selectedOccurrence
    const previousOccurrence = recurrenceId
      ? occurrenceStatus[recurrenceId]
      : undefined
    const previousStatus = status

    if (recurrenceId) {
      setOccurrenceStatus((prev) => ({ ...prev, [recurrenceId]: newStatus }))
    } else {
      setStatus(newStatus)
    }

    // The optimistic update above must be rolled back on failure. Showing the
    // new answer while the server rejected it is how an RSVP silently fails to
    // stick — the participant believes they answered and nothing was recorded.
    try {
      const response = await fetch(`/api/invite/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          ...(recurrenceId ? { recurrenceId } : {}),
        }),
      })
      if (!response.ok) throw new Error('rejected')
      setRsvpError('')
    } catch {
      if (recurrenceId) {
        setOccurrenceStatus((prev) => ({
          ...prev,
          [recurrenceId]: previousOccurrence ?? 'pending',
        }))
      } else {
        setStatus(previousStatus)
      }
      setRsvpError('Could not save your response. Please try again.')
    }
  }

  const handleAddToCalendar = async () => {
    // The response is load-bearing: reporting success unconditionally hid the
    // button on a refusal, leaving the participant with no way to retry and no
    // indication anything went wrong. Mirrors handleRsvp's handling above.
    try {
      const response = await fetch(`/api/invite/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: selectedCategory }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        setAddError(body?.error ?? 'Could not add this event to your calendar.')
        return
      }
      setAddError('')
      setAddedToCalendar(true)
      setCategoryDialogOpen(false)
    } catch {
      setAddError('Could not add this event to your calendar.')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <div className="text-center space-y-4">
          <XCircle className="h-16 w-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold">Invite Not Found</h1>
          <p className="text-muted-foreground">
            {error || 'This invite link is invalid or has expired.'}
          </p>
        </div>
      </div>
    )
  }

  const { event, inviter, occurrences } = data
  // `occurrences === null` (not recurring) and `occurrences.length === 0` (a
  // grant reduced to nothing) are two distinct states. Conflating them rendered
  // an empty grant as a one-off at the master's date, where every RSVP is a
  // guaranteed 400.
  const isRecurring = occurrences !== null
  const hasNoGrantedDates = isRecurring && occurrences.length === 0
  const selected = isRecurring
    ? (occurrences.find((o) => o.recurrenceId === selectedOccurrence) ??
      occurrences[0] ??
      null)
    : null

  // The endpoint always sets event.startDate/endDate from the MASTER row, which
  // for a series says nothing about which occurrences this link grants. Show the
  // selected occurrence instead, or a participant granted one date is told to
  // attend one they cannot see.
  const startDate = new Date(selected?.startDate ?? event.startDate)
  const endDate = new Date(selected?.endDate ?? event.endDate)

  const formatDateRange = () => {
    if (event.isAllDay) {
      return `${format(startDate, 'yyyy-MM-dd')} (All day)`
    }
    return `${format(startDate, 'yyyy-MM-dd HH:mm')} – ${format(endDate, 'yyyy-MM-dd HH:mm')}`
  }

  // Adding to the calendar is per-invite, so any accepted occurrence qualifies.
  const effectiveStatus = isRecurring
    ? selectedOccurrence
      ? (occurrenceStatus[selectedOccurrence] ?? 'pending')
      : 'pending'
    : status
  const anyAccepted = isRecurring
    ? Object.values(occurrenceStatus).some(
        (s) => s === 'accepted' || s === 'maybe',
      )
    : status === 'accepted' || status === 'maybe'
  const canAddToCalendar = anyAccepted && !addedToCalendar

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="flex w-full max-w-sm flex-col">
        <div className="flex justify-center pb-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <Avatar size="lg" className="size-16">
              <AvatarImage
                src={inviter.image || '/user.png'}
                alt={inviter.name || 'inviter'}
              />
              <AvatarFallback className="text-xl">
                {(inviter.name ?? '?').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm text-muted-foreground">
              {inviter.name} invited you to this event
            </p>
          </div>
        </div>

        <Card className="w-full rounded-xl overflow-hidden">
          <div className="px-5 pb-5 mt-4 flex">
            <div
              className="w-2 self-stretch rounded-full mr-4"
              style={{
                backgroundColor: getEventAccentColor(event.color ?? undefined),
              }}
            />
            <div className="flex-1">
              <h2 className="mb-1 text-2xl font-bold break-words break-all overflow-hidden [overflow-wrap:anywhere]">
                {event.title}
              </h2>
              <p className="text-muted-foreground">
                {hasNoGrantedDates
                  ? 'This invitation no longer covers any dates.'
                  : formatDateRange()}
              </p>
            </div>
          </div>

          <CardContent className="px-5 pb-5 space-y-4">
            {event.recurrenceSummary && (
              <div className="flex items-start">
                <Repeat className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p>{event.recurrenceSummary}</p>
                </div>
              </div>
            )}

            {/*
              Only the occurrences this link grants. The list comes from the
              server already filtered; the rule itself is never sent.
            */}
            {isRecurring && occurrences.length >= 1 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Which date?</p>
                <Select
                  value={selectedOccurrence ?? undefined}
                  onValueChange={setSelectedOccurrence}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {occurrences.map((occurrence) => (
                      <SelectItem
                        key={occurrence.recurrenceId}
                        value={occurrence.recurrenceId}
                      >
                        {event.isAllDay
                          ? format(new Date(occurrence.startDate), 'yyyy-MM-dd')
                          : format(
                              new Date(occurrence.startDate),
                              'yyyy-MM-dd HH:mm',
                            )}
                        {occurrenceStatus[occurrence.recurrenceId] !==
                          'pending' &&
                          ` · ${occurrenceStatus[occurrence.recurrenceId]}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {event.meetingUrl && (
              <div className="flex items-start">
                <Video className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <Button asChild size="sm">
                    <a
                      href={event.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Join with Zentra Meet
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {event.location && (
              <div className="flex items-start">
                <MapPin className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p>{event.location}</p>
                </div>
              </div>
            )}

            {event.description && (
              <div className="flex items-start">
                <AlignLeft className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="whitespace-pre-wrap break-words break-all overflow-hidden [overflow-wrap:anywhere]">
                    {event.description}
                  </p>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t-0 bg-transparent px-4 pb-4 pt-2">
            {hasNoGrantedDates ? (
              // Nothing to answer: the organiser has removed every occurrence
              // this link granted, so every RSVP would be refused. Say so
              // rather than offer buttons that cannot succeed.
              <p className="w-full text-left text-sm text-muted-foreground">
                The organiser has removed you from every date this invitation
                covered. There is nothing to respond to.
              </p>
            ) : (
              <>
                <p className="w-full text-left text-sm font-medium">
                  Will you attend?
                </p>
                {/* Reflects the SELECTED occurrence, since each has its own answer. */}
                <div className="flex w-full gap-3">
                  <Button
                    variant={
                      effectiveStatus === 'accepted' ? 'default' : 'outline'
                    }
                    className="flex-1"
                    onClick={() => handleRsvp('accepted')}
                  >
                    Yes
                  </Button>
                  <Button
                    variant={
                      effectiveStatus === 'maybe' ? 'default' : 'outline'
                    }
                    className="flex-1"
                    onClick={() => handleRsvp('maybe')}
                  >
                    Maybe
                  </Button>
                  <Button
                    variant={
                      effectiveStatus === 'declined' ? 'default' : 'outline'
                    }
                    className="flex-1"
                    onClick={() => handleRsvp('declined')}
                  >
                    No
                  </Button>
                </div>

                {rsvpError && (
                  <p className="w-full text-left text-sm text-destructive">
                    {rsvpError}
                  </p>
                )}

                {canAddToCalendar && isRegisteredUser && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setCategoryDialogOpen(true)}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Add to My Calendar
                  </Button>
                )}
              </>
            )}
          </CardFooter>
        </Card>
      </div>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to which category?</DialogTitle>
          </DialogHeader>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__uncategorized__">Uncategorized</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/*
            The refusal is shown here, where the action was taken. The dialog
            stays open so the participant can retry — closing it and reporting
            success was how a refused add looked like a successful one.
          */}
          {addError && <p className="text-sm text-destructive">{addError}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCategoryDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddToCalendar}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
