'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { MapPin, AlignLeft, Calendar, XCircle, Repeat } from 'lucide-react'
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
import { getEventAccentColor } from '@/components/app/views/event-colors'

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
          setSelectedOccurrence(data.occurrences[0].recurrenceId)
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

    if (recurrenceId) {
      setOccurrenceStatus((prev) => ({ ...prev, [recurrenceId]: newStatus }))
    } else {
      setStatus(newStatus)
    }

    await fetch(`/api/invite/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        ...(recurrenceId ? { recurrenceId } : {}),
      }),
    })
  }

  const handleAddToCalendar = async () => {
    await fetch(`/api/invite/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: selectedCategory }),
    })
    setAddedToCalendar(true)
    setCategoryDialogOpen(false)
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
  const isRecurring = !!occurrences && occurrences.length > 0
  const startDate = new Date(event.startDate)
  const endDate = new Date(event.endDate)

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
              <p className="text-muted-foreground">{formatDateRange()}</p>
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
            {isRecurring && occurrences && occurrences.length > 1 && (
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
            <p className="w-full text-left text-sm font-medium">
              Will you attend?
            </p>
            {/* Reflects the SELECTED occurrence, since each has its own answer. */}
            <div className="flex w-full gap-3">
              <Button
                variant={effectiveStatus === 'accepted' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => handleRsvp('accepted')}
              >
                Yes
              </Button>
              <Button
                variant={effectiveStatus === 'maybe' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => handleRsvp('maybe')}
              >
                Maybe
              </Button>
              <Button
                variant={effectiveStatus === 'declined' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => handleRsvp('declined')}
              >
                No
              </Button>
            </div>

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
