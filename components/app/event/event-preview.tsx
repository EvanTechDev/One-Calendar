'use client'

import {
  getEncryptionState,
  readEncryptedLocalStorage,
  subscribeEncryptionState,
  writeEncryptedLocalStorage,
} from '@/hooks/useLocalStorage'
import React, { useState, useRef, useEffect } from 'react'
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
  Download,
} from 'lucide-react'
import { Share as Share2 } from '@/components/icons/share'
import { Button } from '@/components/ui/button'
import { zhCN, enUS } from 'date-fns/locale'
import { format } from 'date-fns'
import type { CalendarEvent } from '../calendar'
import type { Language } from '@/lib/i18n'
import { isZhLanguage, translations } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useCalendar } from '@/components/providers/calendar-context'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import QRCodeStyling from 'qr-code-styling'
import { authClient } from '@/lib/auth-client'

interface EventPreviewProps {
  event: CalendarEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  language: Language
  timezone: string
  openShareImmediately?: boolean
  shareOnlyMode?: boolean
  anchorRect?: DOMRect | null
  modal?: boolean
}

export default function EventPreview({
  event,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onDuplicate,
  language,
  timezone,
  openShareImmediately,
  shareOnlyMode = false,
  anchorRect = null,
  modal = true,
}: EventPreviewProps) {
  const { calendars } = useCalendar()
  const isZh = isZhLanguage(language)
  const t = translations[language]
  const locale = isZh ? zhCN : enUS
  const [participantsOpen, setParticipantsOpen] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [isSharing, setIsSharing] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [qrCodeDataURL, setQRCodeDataURL] = useState<string>('')
  const qrCodeObjectURLRef = useRef<string | null>(null)
  const { data: session } = authClient.useSession()
  const isSignedIn = Boolean(session?.user)
  const user: any = session?.user
  const [atprotoSignedIn, setAtprotoSignedIn] = useState(false)
  const [atprotoHandle, setAtprotoHandle] = useState('')
  const dialogContentRef = useRef<HTMLDivElement>(null)
  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [passwordEnabled, setPasswordEnabled] = useState(false)
  const [sharePassword, setSharePassword] = useState('')
  const [burnAfterRead, setBurnAfterRead] = useState(false)
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
    if (open && openShareImmediately) {
      if (!isSignedIn && !atprotoSignedIn) {
        toast.error(t.shareSignInRequiredTitle, {
          description: t.shareSignInRequiredDescription,
        })
      } else {
        void openShareDialog()
      }
    }
  }, [open, openShareImmediately, isSignedIn, atprotoSignedIn, language])

  useEffect(() => {
    if (open && !modal) {
      ignoreOutsideUntilRef.current = Date.now() + 150
    }
  }, [open, modal])

  useEffect(() => {
    fetch('/api/atproto/session')
      .then((r) => r.json())
      .then((data: { signedIn?: boolean; handle?: string }) => {
        setAtprotoSignedIn(!!data.signedIn)
        setAtprotoHandle(data.handle || '')
      })
      .catch(() => undefined)
  }, [])
  useEffect(() => {
    let active = true
    const loadBookmarks = () =>
      readEncryptedLocalStorage<any[]>('bookmarked-events', []).then(
        (stored) => {
          if (active) {
            setBookmarks(stored)
          }
        },
      )

    loadBookmarks()
    const unsubscribe = subscribeEncryptionState(() => {
      if (getEncryptionState().ready) {
        loadBookmarks()
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!open || !event) return
    readEncryptedLocalStorage<any[]>('bookmarked-events', []).then(
      (storedBookmarks) => {
        setBookmarks(storedBookmarks)
      },
    )
  }, [open, event])

  useEffect(() => {
    return () => {
      if (qrCodeObjectURLRef.current) {
        URL.revokeObjectURL(qrCodeObjectURLRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (event) {
      const isCurrentEventBookmarked = bookmarks.some(
        (bookmark: any) => bookmark.id === event.id,
      )
      setIsBookmarked(isCurrentEventBookmarked)
    }
  }, [event, bookmarks])

  if (!event || (!open && !shareDialogOpen)) return null

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

  const getInitials = (name: string) => name.charAt(0).toUpperCase()

  const hasParticipants =
    event.participants &&
    event.participants.length > 0 &&
    event.participants.some((p) => p.trim() !== '')

  const toggleParticipants = () => setParticipantsOpen(!participantsOpen)

  const generateStyledQRCode = async (link: string) => {
    const { default: QRCodeStyling } = await import('qr-code-styling')
    const qrCode = new QRCodeStyling({
      width: 300,
      height: 300,
      type: 'canvas',
      data: link,
      image: '/icon.svg',
      margin: 8,
      qrOptions: {
        errorCorrectionLevel: 'H',
      },
      dotsOptions: {
        type: 'extra-rounded',
      },
      cornersSquareOptions: {
        type: 'dot',
      },
      cornersDotOptions: {
        type: 'dot',
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.4,
        margin: 10,
        crossOrigin: 'anonymous',
      },
    })

    const qrBlob = await qrCode.getRawData('png')
    if (!qrBlob) {
      throw new Error(t.shareQrGenerateFailed)
    }

    if (qrCodeObjectURLRef.current) {
      URL.revokeObjectURL(qrCodeObjectURLRef.current)
    }
    const qrURL = URL.createObjectURL(qrBlob)
    qrCodeObjectURLRef.current = qrURL
    setQRCodeDataURL(qrURL)
  }

  const openShareDialog = async () => {
    if (!event) return

    setPasswordEnabled(false)
    setSharePassword('')
    setBurnAfterRead(false)
    setShareLink('')
    setQRCodeDataURL('')
    if (qrCodeObjectURLRef.current) {
      URL.revokeObjectURL(qrCodeObjectURLRef.current)
      qrCodeObjectURLRef.current = null
    }

    const storedShares = await readEncryptedLocalStorage<any[]>(
      'shared-events',
      [],
    )
    const existingShare = storedShares
      .filter((share) => share?.eventId === event.id && !!share?.shareLink)
      .sort(
        (a, b) =>
          new Date(b.shareDate || 0).getTime() -
          new Date(a.shareDate || 0).getTime(),
      )[0]

    if (existingShare) {
      setShareLink(existingShare.shareLink)
      await generateStyledQRCode(existingShare.shareLink)
    }

    setShareDialogOpen(true)
  }

  const toggleBookmark = async () => {
    if (!event) return
    if (isBookmarked) {
      const updatedBookmarks = bookmarks.filter(
        (bookmark: any) => bookmark.id !== event.id,
      )
      await writeEncryptedLocalStorage('bookmarked-events', updatedBookmarks)
      setBookmarks(updatedBookmarks)
      setIsBookmarked(false)
      toast(isZh ? '已取消收藏' : 'Removed from bookmarks', {
        description: isZh
          ? '事件已从收藏夹中移除'
          : 'Event has been removed from your bookmarks',
      })
    } else {
      const bookmarkData = {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        color: event.color,
        location: event.location,
        bookmarkedAt: new Date().toISOString(),
      }
      const updatedBookmarks = [...bookmarks, bookmarkData]
      await writeEncryptedLocalStorage('bookmarked-events', updatedBookmarks)
      setBookmarks(updatedBookmarks)
      setIsBookmarked(true)
      toast(isZh ? '已收藏' : 'Bookmarked', {
        description: isZh
          ? '事件已添加到收藏夹'
          : 'Event has been added to your bookmarks',
      })
    }
  }

  const handleShare = async () => {
    if (!event) return
    if (!user && !atprotoSignedIn) {
      toast.error(t.shareSignInRequiredTitle, {
        description: t.shareSignedInOnlyDescription,
      })
      return
    }

    if (passwordEnabled) {
      const pwd = sharePassword.trim()
      if (pwd.length < 4) {
        toast.error(t.sharePasswordTooShortTitle, {
          description: t.sharePasswordTooShortDescription,
        })
        return
      }
    } else {
      if (burnAfterRead) setBurnAfterRead(false)
    }

    try {
      setIsSharing(true)
      const shareId =
        Date.now().toString() + Math.random().toString(36).substring(2, 9)
      const clerkUsername =
        user?.username || user?.firstName || atprotoHandle || 'Anonymous'
      const sharedEvent = { ...event, sharedBy: clerkUsername }

      const payload: any = { id: shareId, data: sharedEvent }
      if (passwordEnabled) payload.password = sharePassword
      if (passwordEnabled) payload.burnAfterRead = !!burnAfterRead

      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const msg = await response.json().catch(() => null)
        throw new Error(msg?.error || t.shareFailedGeneric)
      }

      const result = await response.json()

      if (result.success) {
        const link = result?.shareLink
          ? `${window.location.origin}${result.shareLink}`
          : `${window.location.origin}/share/${shareId}`
        setShareLink(link)

        try {
          const qrCode = new QRCodeStyling({
            width: 300,
            height: 300,
            type: 'canvas',
            data: link,
            image: '/icon.svg',
            margin: 8,
            qrOptions: {
              errorCorrectionLevel: 'H',
            },
            dotsOptions: {
              type: 'extra-rounded',
            },
            cornersSquareOptions: {
              type: 'dot',
            },
            cornersDotOptions: {
              type: 'dot',
            },
            imageOptions: {
              hideBackgroundDots: true,
              imageSize: 0.4,
              margin: 10,
            },
          })
          const qrBlob = await qrCode.getRawData('png')
          if (qrBlob) {
            if (qrCodeObjectURLRef.current) {
              URL.revokeObjectURL(qrCodeObjectURLRef.current)
            }
            const qrURL = URL.createObjectURL(qrBlob)
            qrCodeObjectURLRef.current = qrURL
            setQRCodeDataURL(qrURL)
          }
        } catch {}

        const storedShares = await readEncryptedLocalStorage<any[]>(
          'shared-events',
          [],
        )
        storedShares.push({
          id: shareId,
          eventId: event.id,
          eventTitle: event.title,
          sharedBy: clerkUsername,
          shareDate: new Date().toISOString(),
          shareLink: link,
          protected: !!passwordEnabled,
          burnAfterRead: !!burnAfterRead,
        })
        await writeEncryptedLocalStorage('shared-events', storedShares)

        toast.success(t.shareSuccessTitle, {
          description:
            passwordEnabled && burnAfterRead
              ? t.shareSuccessPasswordAndBurn
              : passwordEnabled
                ? t.shareSuccessPasswordOnly
                : t.shareSuccessLinkGenerated,
        })
      } else {
        throw new Error(t.shareFailedGeneric)
      }
    } catch (error) {
      toast.error(t.shareFailedTitle, {
        description: error instanceof Error ? error.message : t.unknownError,
      })
    } finally {
      setIsSharing(false)
    }
  }

  const copyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink)
      toast.success(t.shareLinkCopiedTitle, {
        description: t.shareLinkCopiedDescription,
      })
    }
  }

  const downloadQRCode = () => {
    if (qrCodeDataURL) {
      const link = document.createElement('a')
      link.href = qrCodeDataURL
      link.download = `${event?.title || 'event'}-qrcode.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success(t.qrCodeDownloaded, {
        description: t.savedToDevice,
      })
    }
  }

  const handleShareDialogChange = (open: boolean) => {
    if (!open) {
      setShareLink('')
      setQRCodeDataURL('')
      if (qrCodeObjectURLRef.current) {
        URL.revokeObjectURL(qrCodeObjectURLRef.current)
        qrCodeObjectURLRef.current = null
      }
      setPasswordEnabled(false)
      setSharePassword('')
      setBurnAfterRead(false)
    }
    setShareDialogOpen(open)
  }

  const handleDialogClick = (e: React.MouseEvent) => e.stopPropagation()

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete()
  }

  const popoverSide: 'top' | 'right' | 'bottom' | 'left' = anchorRect
    ? (() => {
        const viewportWidth =
          typeof window === 'undefined' ? 0 : window.innerWidth
        const viewportHeight =
          typeof window === 'undefined' ? 0 : window.innerHeight
        const spaces = {
          top: anchorRect.top,
          right: viewportWidth - anchorRect.right,
          bottom: viewportHeight - anchorRect.bottom,
          left: anchorRect.left,
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
    if (anchorRect) {
      const midX = anchorRect.left + anchorRect.width / 2
      const midY = anchorRect.top + anchorRect.height / 2
      const edgePoint =
        popoverSide === 'right'
          ? { left: anchorRect.right, top: midY }
          : popoverSide === 'left'
            ? { left: anchorRect.left, top: midY }
            : popoverSide === 'top'
              ? { left: midX, top: anchorRect.top }
              : { left: midX, top: anchorRect.bottom }
      return {
        position: 'fixed',
        left: edgePoint.left,
        top: edgePoint.top,
        width: 0,
        height: 0,
        pointerEvents: 'none',
      }
    }

    return {
      position: 'fixed',
      left:
        typeof window === 'undefined' ? 0 : Math.round(window.innerWidth / 2),
      top:
        typeof window === 'undefined' ? 0 : Math.round(window.innerHeight / 2),
      width: 0,
      height: 0,
      pointerEvents: 'none',
    }
  })()

  return (
    <>
      {!shareOnlyMode && (
        <Popover open={open} onOpenChange={onOpenChange} modal={modal}>
          <PopoverAnchor asChild>
            <div style={anchorStyle} />
          </PopoverAnchor>
          <PopoverContent
            side={popoverSide}
            align="center"
            sideOffset={12}
            className="w-[min(96vw,28rem)] rounded-xl p-0 overflow-hidden"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (!modal) {
                if (Date.now() < ignoreOutsideUntilRef.current) {
                  e.preventDefault()
                  return
                }
                onOpenChange(false)
              }
            }}
          >
            <div className="flex justify-between items-center p-5">
              <div className="w-24" />
              <div className="flex space-x-2 ml-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit()}
                  className="h-8 w-8"
                >
                  <Edit2 className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isSignedIn && !atprotoSignedIn) {
                      toast.error(t.shareSignInRequiredTitle, {
                        description: t.shareSignInRequiredDescription,
                      })
                      return
                    }
                    void openShareDialog()
                  }}
                  className="h-8 w-8"
                >
                  <Share2 className="h-5 w-5" />
                </Button>
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

              {hasParticipants && (
                <div className="flex items-start">
                  <Users className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={toggleParticipants}
                    >
                      <p>
                        {
                          event.participants.filter((p) => p.trim() !== '')
                            .length
                        }{' '}
                        {isZh ? '参与者' : 'participants'}
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
                        {event.participants
                          .filter((p) => p.trim() !== '')
                          .map((participant, index) => (
                            <div key={index} className="flex items-center">
                              <div className="bg-gray-200 rounded-full h-8 w-8 flex items-center justify-center mr-2">
                                <span className="font-medium">
                                  {getInitials(participant)}
                                </span>
                              </div>
                              <p>{participant}</p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {getCalendarName() && (
                <div className="flex items-start">
                  <Calendar className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p>{getCalendarName()}</p>
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
            </div>
          </PopoverContent>
        </Popover>
      )}

      <Dialog
        open={shareDialogOpen}
        onOpenChange={(nextOpen) => {
          handleShareDialogChange(nextOpen)
          if (!nextOpen && shareOnlyMode) onOpenChange(false)
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          ref={dialogContentRef}
          onClick={handleDialogClick}
        >
          <DialogHeader>
            <DialogTitle>{t.shareEvent}</DialogTitle>
          </DialogHeader>

          {!shareLink ? (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="shared-by">{t.share}</Label>
                <p className="text-sm text-muted-foreground">
                  {t.shareIdentityDescription}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enable-password">
                    {t.shareEnablePasswordProtection}
                  </Label>
                  <Checkbox
                    id="enable-password"
                    checked={passwordEnabled}
                    onCheckedChange={(checked) => {
                      const v = checked === true
                      setPasswordEnabled(v)
                      if (!v) {
                        setSharePassword('')
                        setBurnAfterRead(false)
                      }
                    }}
                  />
                </div>

                {passwordEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="share-password">
                      {t.sharePasswordLabel}
                    </Label>
                    <Input
                      id="share-password"
                      type="password"
                      value={sharePassword}
                      onChange={(e) => setSharePassword(e.target.value)}
                      placeholder={t.sharePasswordPlaceholder}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t.sharePasswordHelp}
                    </p>

                    <div className="flex items-center justify-between pt-2">
                      <Label htmlFor="burn-after-read">
                        {t.shareBurnAfterRead}
                      </Label>
                      <Checkbox
                        id="burn-after-read"
                        checked={burnAfterRead}
                        onCheckedChange={(checked) =>
                          setBurnAfterRead(checked === true)
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.shareBurnAfterReadHelp}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleShareDialogChange(false)
                  }}
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleShare()
                  }}
                  disabled={isSharing}
                >
                  {isSharing ? (
                    <span className="flex items-center">
                      <Spinner className="mr-2" />
                      {t.shareSharing}
                    </span>
                  ) : (
                    <>{t.share}</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="share-link">{t.shareLink}</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="share-link"
                      value={shareLink}
                      readOnly
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyShareLink()
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyShareLink()
                      }}
                    >
                      {t.copy}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t.shareLinkHelp}
                  </p>
                </div>

                {qrCodeDataURL && (
                  <div className="mt-4 flex flex-col items-center">
                    <Label className="mb-2">{t.qrCode}</Label>
                    <div className="border p-3 rounded bg-white mb-2">
                      <img
                        src={qrCodeDataURL || '/placeholder.svg'}
                        alt="QR Code"
                        className="w-full max-w-[200px] mx-auto"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadQRCode()
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {t.downloadQRCode}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      {t.scanQRCodeToView}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleShareDialogChange(false)
                  }}
                >
                  {t.done}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
