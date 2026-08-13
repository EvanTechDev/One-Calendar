'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import {
  MapPin,
  AlignLeft,
  Calendar,
  Clock,
  User as UserIcon,
} from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { ButtonGroup } from '@zntr/ui/button-group'
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
  }
  inviter: {
    name: string
    email?: string
  }
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
        setLoading(false)

        const email = data.invite.email?.trim().toLowerCase()
        if (email) {
          return fetch(`/api/users?emails=${encodeURIComponent(email)}`)
            .then((res) => res.json())
            .then((userData: { users: Record<string, { name: string }> }) => {
              if (userData.users && userData.users[email]) {
                setIsRegisteredUser(true)
              }
            })
            .catch(() => {})
        }
        return undefined
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [token])

  const handleRsvp = async (newStatus: 'accepted' | 'maybe' | 'declined') => {
    setStatus(newStatus)
    await fetch(`/api/invite/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-destructive">{error || 'Invite not found'}</div>
      </div>
    )
  }

  const { event, inviter } = data
  const startDate = new Date(event.startDate)
  const endDate = new Date(event.endDate)

  const formatDateRange = () => {
    if (event.isAllDay) {
      return `${format(startDate, 'yyyy-MM-dd')} (All day)`
    }
    return `${format(startDate, 'yyyy-MM-dd HH:mm')} – ${format(endDate, 'yyyy-MM-dd HH:mm')}`
  }

  const canAddToCalendar =
    (status === 'accepted' || status === 'maybe') && !addedToCalendar

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="rounded-xl border bg-card p-6 space-y-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              <UserIcon className="inline h-4 w-4 mr-1" />
              {inviter.name} invited you to this event
            </p>
            <h1 className="text-2xl font-bold">{event.title}</h1>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span>{formatDateRange()}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <span>{event.location}</span>
              </div>
            )}
            {event.description && (
              <div className="flex items-start gap-3">
                <AlignLeft className="h-5 w-5 text-muted-foreground mt-0.5" />
                <p className="whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Will you attend?</p>
            <ButtonGroup orientation="horizontal">
              <Button
                variant={status === 'accepted' ? 'default' : 'outline'}
                onClick={() => handleRsvp('accepted')}
              >
                Yes
              </Button>
              <Button
                variant={status === 'maybe' ? 'default' : 'outline'}
                onClick={() => handleRsvp('maybe')}
              >
                Maybe
              </Button>
              <Button
                variant={status === 'declined' ? 'default' : 'outline'}
                onClick={() => handleRsvp('declined')}
              >
                No
              </Button>
            </ButtonGroup>
          </div>

          {canAddToCalendar && isRegisteredUser && (
            <Button onClick={() => setCategoryDialogOpen(true)}>
              <Calendar className="mr-2 h-4 w-4" />
              Add to My Calendar
            </Button>
          )}
        </div>
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
