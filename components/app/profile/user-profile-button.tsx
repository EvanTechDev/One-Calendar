'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  User,
  LogOut,
  CircleUser,
  CloudUpload,
  Trash2,
  KeyRound,
  Mail,
  Link as LinkIcon,
  RefreshCcw,
  Camera,
  BarChart2,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { InputOTP } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { useCalendar } from '@/components/providers/calendar-context'
import { translations, useLanguage } from '@/lib/i18n'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import {
  decryptPayload,
  encryptPayload,
  isEncryptedPayload,
} from '@/lib/crypto'
import {
  readInMemoryStorage,
  clearEncryptionPassword,
  isSensitiveStorageKey,
  markEncryptedSnapshot,
  removeInMemoryStorage,
  readEncryptedLocalStorage,
  setEncryptionPassword,
  writeEncryptedLocalStorage,
  writeInMemoryStorage,
} from '@/hooks/useLocalStorage'

const AUTO_KEY = 'auto-backup-enabled'
const BACKUP_STATUS_KEY = 'auto-backup-sync-status'
const BACKUP_VERSION = 1
const BACKUP_KEYS = [
  'calendar-events',
  'calendar-categories',
  'bookmarked-events',
  'shared-events',
  'countdowns',
  'timezone',
  'notification-sound',
  'enable-shortcuts',
  'preferred-language',
  'first-day-of-week',
  'default-view',
  'skip-landing',
  'today-toast',
  'toast-position',
]

const BACKUP_KEY_DEFAULTS: Record<string, unknown> = {
  'calendar-events': [],
  'calendar-categories': [],
  'bookmarked-events': [],
  'shared-events': [],
  countdowns: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  'notification-sound': 'telegram',
  'enable-shortcuts': true,
  'preferred-language': null,
  'first-day-of-week': 0,
  'default-view': 'week',
  'skip-landing': false,
  'today-toast': null,
  'toast-position': 'bottom-right',
}

async function apiGet() {
  const r = await fetch('/api/blob', { cache: 'no-store' })
  if (r.status === 404) return null
  if (!r.ok) throw new Error()
  return r.json()
}

async function apiPost(body: any) {
  const r = await fetch('/api/blob', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error()
}

async function apiDelete() {
  const r = await fetch('/api/blob', { method: 'DELETE' })
  if (!r.ok) throw new Error()
}

async function collectLocalStorage() {
  const storage: Record<string, string> = {}

  await Promise.all(
    BACKUP_KEYS.map(async (key) => {
      const fallback = BACKUP_KEY_DEFAULTS[key] ?? null
      const inMemoryValue = readInMemoryStorage(key)
      if (inMemoryValue !== null) {
        storage[key] = inMemoryValue
        return
      }

      const hasRawItem = localStorage.getItem(key) !== null
      const value = await readEncryptedLocalStorage(key, fallback)
      if (value === null && !hasRawItem) return
      storage[key] = JSON.stringify(value)
    }),
  )

  return storage
}

async function normalizeCloudStorageValue(
  value: string,
  password: string,
): Promise<string> {
  try {
    const parsed = JSON.parse(value)
    if (!isEncryptedPayload(parsed)) {
      return value
    }

    return await decryptPayload(password, parsed.ciphertext, parsed.iv)
  } catch {
    return value
  }
}

async function applyCloudStorageToMemory(storage: Record<string, string>) {
  await Promise.all(
    Object.entries(storage).map(async ([key, value]) => {
      let parsedValue: unknown = value
      try {
        parsedValue = JSON.parse(value)
      } catch {
        parsedValue = value
      }

      await writeEncryptedLocalStorage(key, parsedValue)

      if (isSensitiveStorageKey(key)) {
        const normalized =
          typeof parsedValue === 'string'
            ? parsedValue
            : JSON.stringify(parsedValue)
        writeInMemoryStorage(key, normalized)
        markEncryptedSnapshot(key, normalized)
      } else {
        removeInMemoryStorage(key)
      }
    }),
  )
}

export type UserProfileSection =
  | 'profile'
  | 'backup'
  | 'key'
  | 'delete'
  | 'signout'

type UserProfileButtonProps = {
  variant?: React.ComponentProps<typeof Button>['variant']
  className?: string
  mode?: 'dropdown' | 'settings'
  onNavigateToSettings?: (section: UserProfileSection) => void
  onNavigateToView?: (view: 'analytics' | 'settings') => void
  focusSection?: UserProfileSection | null
}

export default function UserProfileButton({
  variant = 'ghost',
  className = '',
  mode = 'dropdown',
  onNavigateToSettings,
  onNavigateToView,
  focusSection = null,
}: UserProfileButtonProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const { events, calendars, setEvents, setCalendars } = useCalendar()
  const { data: session } = authClient.useSession()
  const user: any = session?.user
  const isSignedIn = Boolean(session?.user)
  const router = useRouter()
  const isAnySignedIn = isSignedIn

  const [enabled, setEnabled] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [setPwdOpen, setSetPwdOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [deleteCloudOpen, setDeleteCloudOpen] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('')
  const [deleteCloudConfirmText, setDeleteCloudConfirmText] = useState('')
  const [profileSection, setProfileSection] = useState<
    'basic' | 'emails' | 'oauth' | 'security'
  >('basic')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [error, setError] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [twoFactorPassword, setTwoFactorPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorPending, setTwoFactorPending] = useState(false)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  const keyRef = useRef<string | null>(null)
  const lastBackupSnapshotRef = useRef<string | null>(null)
  const restoredRef = useRef(false)
  const skipNextAutoBackupRef = useRef(false)
  const timerRef = useRef<any>(null)
  const [backupTick, setBackupTick] = useState(0)

  const broadcastBackupStatus = (status: 'uploading' | 'failed' | 'done') => {
    localStorage.setItem(BACKUP_STATUS_KEY, status)
    window.dispatchEvent(
      new CustomEvent('backup-status-change', { detail: { status } }),
    )
  }



  useEffect(() => {
    if (mode !== 'settings' || !focusSection) return
    const target = document.getElementById(`settings-account-${focusSection}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusSection, mode])

  useEffect(() => {
    if (!deleteAccountOpen) {
      setDeleteAccountConfirmText('')
    }
  }, [deleteAccountOpen])

  useEffect(() => {
    setEnabled(localStorage.getItem(AUTO_KEY) === 'true')
  }, [])

  useEffect(() => {
    setTwoFactorEnabled(Boolean((session as any)?.user?.twoFactorEnabled))
  }, [session])

  useEffect(() => {
    if (!user) return
    const fullName = (user.name || '').trim()
    const parts = fullName ? fullName.split(/\s+/) : []
    setFirstName(parts[0] || '')
    setLastName(parts.slice(1).join(' '))
  }, [user])

  useEffect(() => {
    if (mode === 'settings') return
    if (!isAnySignedIn || keyRef.current || restoredRef.current) return
    apiGet().then((cloud) => {
      if (cloud) setUnlockOpen(true)
    })
  }, [isAnySignedIn, mode])

  useEffect(() => {
    const watchKeys = new Set(BACKUP_KEYS)
    const handleLocalWrite = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>
      if (!customEvent.detail?.key || watchKeys.has(customEvent.detail.key)) {
        setBackupTick((prev) => prev + 1)
      }
    }

    window.addEventListener('local-storage-written', handleLocalWrite)
    const handleLanguageChange = () => setBackupTick((prev) => prev + 1)
    window.addEventListener('languagechange', handleLanguageChange)
    return () => {
      window.removeEventListener('local-storage-written', handleLocalWrite)
      window.removeEventListener('languagechange', handleLanguageChange)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !keyRef.current || !restoredRef.current) return
    if (skipNextAutoBackupRef.current) {
      skipNextAutoBackupRef.current = false
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      try {
        broadcastBackupStatus('uploading')
        const storage = await collectLocalStorage()
        const snapshot = JSON.stringify({ v: BACKUP_VERSION, storage })
        if (lastBackupSnapshotRef.current === snapshot) {
          broadcastBackupStatus('done')
          return
        }
        const payload = await encryptPayload(keyRef.current!, snapshot)
        await apiPost(payload)
        lastBackupSnapshotRef.current = snapshot
        broadcastBackupStatus('done')
      } catch {
        broadcastBackupStatus('failed')
      } finally {
        timerRef.current = null
      }
    }, 800)
  }, [enabled, backupTick])

  async function saveProfile() {
    if (!user) return
    try {
      setProfileSaving(true)
      const name = `${firstName} ${lastName}`.trim()
      const { error } = await authClient.updateUser({ name: name || null })
      if (error) throw new Error(error.message || 'Failed to update profile')
      toast(t.profileUpdated)
    } catch (e: any) {
      toast(t.profileUpdateFailed, {
        description: e?.errors?.[0]?.longMessage || e?.message || '',
      })
    } finally {
      setProfileSaving(false)
    }
  }

  async function updateAvatar(file?: File | null) {
    if (!user || !file) return
    try {
      setAvatarUploading(true)
      const MAX_OUTPUT_BYTES = 4 * 1024 * 1024
      const MAX_SOURCE_BYTES = 20 * 1024 * 1024
      const MAX_DIMENSION = 512
      const INITIAL_QUALITY = 0.92
      const MIN_QUALITY = 0.5
      const QUALITY_STEP = 0.08
      if (file.size > MAX_SOURCE_BYTES) {
        throw new Error('Image is too large. Please choose a smaller file.')
      }
      const image = await new Promise<string>((resolve, reject) => {
        const img = new Image()
        const reader = new FileReader()
        reader.onload = () => {
          img.src = String(reader.result || '')
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        img.onload = () => {
          const side = Math.min(img.width, img.height)
          const sx = Math.floor((img.width - side) / 2)
          const sy = Math.floor((img.height - side) / 2)
          const target = Math.min(side, MAX_DIMENSION)
          const canvas = document.createElement('canvas')
          canvas.width = target
          canvas.height = target
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Failed to process image'))
          ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target)
          let quality = INITIAL_QUALITY
          let data = canvas.toDataURL('image/jpeg', quality)
          const getDataBytes = (base64DataUrl: string) => {
            const payload = base64DataUrl.split(',')[1] || ''
            return atob(payload).length
          }
          while (getDataBytes(data) > MAX_OUTPUT_BYTES && quality > MIN_QUALITY) {
            quality -= QUALITY_STEP
            data = canvas.toDataURL('image/jpeg', quality)
          }
          if (getDataBytes(data) > MAX_OUTPUT_BYTES) {
            return reject(new Error('Image is too large after processing. Please choose a smaller file.'))
          }
          resolve(data)
        }
        img.onerror = () => reject(new Error('Unsupported image format'))
        reader.readAsDataURL(file)
      })
      const { error } = await authClient.updateUser({ image })
      if (error) throw new Error(error.message || 'Failed to update avatar')
      toast(t.avatarUpdated)
    } catch (e: any) {
      toast(t.avatarUpdateFailed, {
        description: e?.errors?.[0]?.longMessage || e?.message || '',
      })
    } finally {
      setAvatarUploading(false)
    }
  }

  async function addEmailAddress() {
    if (!user || !newEmail) return
    try {
      const email = await user.createEmailAddress({ email: newEmail })
      await email.prepareVerification({ strategy: 'email_code' })
      setNewEmail('')
      toast(t.emailAddedCheckInbox)
      await user.reload()
    } catch (e: any) {
      toast(t.addEmailFailed, {
        description: e?.errors?.[0]?.longMessage || e?.message || '',
      })
    }
  }

  async function setPrimaryEmail(emailId: string) {
    if (!user) return
    try {
      await user.update({ primaryEmailAddressId: emailId })
      toast(t.primaryEmailUpdated)
      await user.reload()
    } catch (e: any) {
      toast(t.primaryEmailUpdateFailed, {
        description: e?.errors?.[0]?.longMessage || e?.message || '',
      })
    }
  }

  async function unlinkOAuth(accountId: string) {
    if (!user) return
    try {
      const target = user.externalAccounts.find((acc) => acc.id === accountId)
      if (!target) return
      await target.destroy()
      toast(t.oauthDisconnected)
      await user.reload()
    } catch (e: any) {
      toast(t.disconnectFailed, {
        description: e?.errors?.[0]?.longMessage || e?.message || '',
      })
    }
  }

  const hydrateEvent = (raw: any): CalendarEvent => {
    const startDate = raw?.startDate ? new Date(raw.startDate) : new Date()
    const endDate = raw?.endDate
      ? new Date(raw.endDate)
      : new Date(startDate.getTime() + 60 * 60 * 1000)

    return {
      id: raw?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: raw?.title || t.unnamedEvent,
      startDate,
      endDate:
        endDate < startDate
          ? new Date(startDate.getTime() + 60 * 60 * 1000)
          : endDate,
      isAllDay: Boolean(raw?.isAllDay),
      recurrence: ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(
        raw?.recurrence,
      )
        ? raw.recurrence
        : 'none',
      location: raw?.location,
      participants: Array.isArray(raw?.participants) ? raw.participants : [],
      notification:
        typeof raw?.notification === 'number' ? raw.notification : 0,
      description: raw?.description,
      color: raw?.color || 'bg-blue-500',
      calendarId: raw?.calendarId || '1',
    }
  }

  async function unlock() {
    if (!password) return

    try {
      setIsUnlocking(true)
      const cloud = await apiGet()
      if (!cloud) return

      let plain
      try {
        plain = await decryptPayload(password, cloud.ciphertext, cloud.iv)
      } catch {
        toast(t.incorrectPassword)
        return
      }

      try {
        const data = JSON.parse(plain)
        if (data?.storage) {
          const normalizedStorage = Object.fromEntries(
            await Promise.all(
              Object.entries(data.storage).map(async ([key, value]) => [
                key,
                await normalizeCloudStorageValue(String(value), password),
              ]),
            ),
          )
          await setEncryptionPassword(password)
          await applyCloudStorageToMemory(normalizedStorage)
        } else if (data?.events || data?.calendars) {
          const fallbackStorage: Record<string, string> = {}
          if (data?.events)
            fallbackStorage['calendar-events'] = JSON.stringify(data.events)
          if (data?.calendars)
            fallbackStorage['calendar-categories'] = JSON.stringify(
              data.calendars,
            )
          await setEncryptionPassword(password)
          await applyCloudStorageToMemory(fallbackStorage)
        } else {
          await setEncryptionPassword(password)
        }

        const restoredEvents = await readEncryptedLocalStorage(
          'calendar-events',
          [],
        )
        const restoredCalendars = await readEncryptedLocalStorage(
          'calendar-categories',
          [],
        )
        const restoredLanguage = await readEncryptedLocalStorage<string | null>(
          'preferred-language',
          null,
        )
        setEvents(restoredEvents)
        setCalendars(restoredCalendars)
        if (restoredLanguage) {
          window.dispatchEvent(
            new CustomEvent('languagechange', {
              detail: { language: restoredLanguage },
            }),
          )
        }
        window.dispatchEvent(new CustomEvent('backup-restored'))
      } catch {}

      keyRef.current = password
      restoredRef.current = true
      skipNextAutoBackupRef.current = true
      localStorage.setItem(AUTO_KEY, 'true')
      setEnabled(true)
      broadcastBackupStatus('done')

      setPassword('')
      setUnlockOpen(false)
      toast(t.dataRestoredAutoBackupEnabled)
    } finally {
      setIsUnlocking(false)
    }
  }

  async function enable() {
    if (password !== confirm) {
      setError(t.passwordsDoNotMatch)
      return
    }
    await setEncryptionPassword(password)
    const payload = await encryptPayload(
      password,
      JSON.stringify({
        v: BACKUP_VERSION,
        storage: await collectLocalStorage(),
      }),
    )
    await apiPost(payload)
    lastBackupSnapshotRef.current = JSON.stringify({
      v: BACKUP_VERSION,
      storage: await collectLocalStorage(),
    })
    localStorage.setItem(AUTO_KEY, 'true')
    keyRef.current = password
    restoredRef.current = true
    setEnabled(true)
    broadcastBackupStatus('done')
    setPassword('')
    setConfirm('')
    setSetPwdOpen(false)
    toast(t.autoBackupEnabled)
  }

  async function rotate() {
    if (password !== confirm) {
      setError(t.passwordsDoNotMatch)
      return
    }
    const cloud = await apiGet()
    if (!cloud) return

    try {
      await decryptPayload(oldPassword, cloud.ciphertext, cloud.iv)
    } catch {
      toast(t.incorrectOldPassword)
      return
    }

    const next = await encryptPayload(
      password,
      JSON.stringify({
        v: BACKUP_VERSION,
        storage: await collectLocalStorage(),
      }),
    )
    await apiPost(next)
    lastBackupSnapshotRef.current = JSON.stringify({
      v: BACKUP_VERSION,
      storage: await collectLocalStorage(),
    })
    await setEncryptionPassword(password)
    keyRef.current = password
    setRotateOpen(false)
    setOldPassword('')
    setPassword('')
    setConfirm('')
    toast(t.encryptionKeyUpdated)
  }

  function disableAutoBackup() {
    localStorage.removeItem(AUTO_KEY)
    localStorage.removeItem(BACKUP_STATUS_KEY)
    keyRef.current = null
    lastBackupSnapshotRef.current = null
    restoredRef.current = false
    setEnabled(false)
    clearEncryptionPassword()
    toast(t.autoBackupDisabled)
  }

  async function destroy() {
    await apiDelete()
    localStorage.removeItem(AUTO_KEY)
    localStorage.removeItem(BACKUP_STATUS_KEY)
    keyRef.current = null
    lastBackupSnapshotRef.current = null
    restoredRef.current = false
    setEnabled(false)
    toast(t.cloudDataDeleted)
  }

  const openProfileSection = (section: 'basic' | 'emails' | 'oauth' | 'security') => {
    setProfileSection(section)
    setProfileOpen(true)
  }


  async function enableTwoFactor() {
    if (!twoFactorPassword) return
    setTwoFactorPending(true)
    const setupRes = await authClient.twoFactor.enable({ password: twoFactorPassword })
    if (setupRes.error) {
      toast(setupRes.error.message || 'Failed to enable 2FA')
      setTwoFactorPending(false)
      return
    }
    setTwoFactorEnabled(true)
    setTwoFactorPending(false)
    toast('Two-factor authentication enabled.')
  }

  async function disableTwoFactor() {
    if (!twoFactorPassword) return
    setTwoFactorPending(true)
    const disableRes = await authClient.twoFactor.disable({ password: twoFactorPassword })
    if (disableRes.error) {
      toast(disableRes.error.message || 'Failed to disable 2FA')
      setTwoFactorPending(false)
      return
    }
    setTwoFactorEnabled(false)
    setTwoFactorPending(false)
    toast('Two-factor authentication disabled.')
  }

  async function verifyTwoFactorSetup() {
    if (twoFactorCode.length < 6) return
    setTwoFactorPending(true)
    const verifyRes = await authClient.twoFactor.verifyTotp({ code: twoFactorCode, trustDevice: true })
    if (verifyRes.error) {
      toast(verifyRes.error.message || 'Invalid TOTP code')
      setTwoFactorPending(false)
      return
    }
    toast('2FA setup verified.')
    setTwoFactorCode('')
    setTwoFactorPending(false)
  }
  async function deleteAccount() {
    if (!user || deleteAccountConfirmText !== 'DELETE MY ACCOUNT') return
    try {
      setIsDeletingAccount(true)
      const response = await fetch('/api/account', { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to delete account data')
      }

      await user.delete()

      toast(t.accountDeleted)
      router.replace('/')
    } catch (e: any) {
      toast(t.deleteAccountFailed, {
        description: e?.message || '',
      })
    } finally {
      setIsDeletingAccount(false)
      setDeleteAccountOpen(false)
    }
  }

  return (
    <>
      {mode === 'dropdown' ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {(isSignedIn && user?.image) ||
            false ? (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full overflow-hidden h-8 w-8 p-0"
              >
                <img
                  src={user.image}
                  alt="avatar"
                  width={32}
                  height={32}
                  className="rounded-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </Button>
            ) : (
              <Button
                variant={variant}
                size="icon"
                className={`rounded-full h-10 w-10 ${className}`}
              >
                <User className="h-5 w-5" />
              </Button>
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            {!isAnySignedIn ? (
              <>
                <DropdownMenuItem onClick={() => router.push('/sign-in')}>
                  {t.signIn}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/sign-up')}>
                  {t.signUp}
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuItem onClick={() => onNavigateToView?.('settings')}>
              <Settings className="mr-2 h-4 w-4" />
              {t.settings}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigateToView?.('analytics')}>
              <BarChart2 className="mr-2 h-4 w-4" />
              {t.analytics}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="rounded-lg border p-4 space-y-4">
          {isAnySignedIn ? (
            <>
              <div className="flex items-center gap-3">
                <img
                  src={user?.image || '/placeholder.svg'}
                  alt="avatar"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full border object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {user?.email || ''}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {isSignedIn ? (
                  <>
                    <div className="space-y-3 rounded-md border p-3">
                      <p className="text-sm font-semibold">{t.basicInfo}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.editProfileDescription}
                      </p>
                      <Button
                        id="settings-account-profile"
                        variant="outline"
                        onClick={() => openProfileSection('basic')}
                      >
                        <CircleUser className="h-4 w-4 mr-2" />
                        {t.openBasicInfo}
                      </Button>
                    </div>

                    <div className="space-y-3 rounded-md border p-3">
                      <p className="text-sm font-semibold">
                        {t.emailManagement}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.manageEmailAddressesDescription}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => openProfileSection('emails')}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        {t.openEmailSettings}
                      </Button>
                    </div>

                    <div className="space-y-3 rounded-md border p-3">
                      <p className="text-sm font-semibold">OAuth</p>
                      <p className="text-xs text-muted-foreground">
                        {t.manageOauthDescription}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => openProfileSection('oauth')}
                      >
                        <LinkIcon className="h-4 w-4 mr-2" />
                        {t.openOauthSettings}
                      </Button>
                    </div>

                    <div className="space-y-3 rounded-md border p-3">
                      <p className="text-sm font-semibold">Security</p>
                      <p className="text-xs text-muted-foreground">Manage password and two-factor authentication.</p>
                      <Button variant="outline" onClick={() => openProfileSection('security')}>
                        <KeyRound className="h-4 w-4 mr-2" />
                        Open security settings
                      </Button>
                    </div>
                  </>
                ) : null}

                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-semibold">{t.autoBackup}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.autoBackupHelp}
                  </p>
                  <Button
                    id="settings-account-backup"
                    variant="outline"
                    onClick={() => setBackupOpen(true)}
                  >
                    <CloudUpload className="h-4 w-4 mr-2" />
                    {t.openBackupSettings}
                  </Button>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-semibold">{t.changeKey}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.rotateKeyHelp}
                  </p>
                  <Button
                    id="settings-account-key"
                    variant="outline"
                    onClick={() => setRotateOpen(true)}
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    {t.changeEncryptionKeyAction}
                  </Button>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-semibold">{t.signOut}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.signOutHelp}
                  </p>
                  {isSignedIn ? (
                    <Button
                      id="settings-account-signout"
                      variant="outline"
                      onClick={async () => {
                        await authClient.signOut()
                        router.refresh()
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {t.signOut}
                    </Button>
                  ) : (
                    <Button
                      id="settings-account-signout"
                      variant="outline"
                      onClick={async () => {
                        await authClient.signOut()
                        router.refresh()
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {t.signOut}
                    </Button>
                  )}
                </div>

                <div className="rounded-md border border-destructive/70 p-3 space-y-3 bg-destructive/5">
                  <p className="text-sm font-semibold text-destructive">
                    {t.dangerZone}
                  </p>
                  <div className="space-y-3 rounded-md border border-destructive/50 p-3">
                    <p className="text-sm font-semibold text-destructive">
                      {t.deleteData}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.deleteAccountDataHelp}
                    </p>
                    <Button
                      id="settings-account-delete"
                      variant="destructive"
                      onClick={() => setDeleteCloudOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t.deleteData}
                    </Button>
                  </div>
                  {isSignedIn ? (
                    <div className="space-y-3 rounded-md border border-destructive/50 p-3">
                      <p className="text-sm font-semibold text-destructive">
                        {t.deleteAccount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.deleteAccountPermanentHelp}
                      </p>
                      <Button
                        variant="destructive"
                        onClick={() => setDeleteAccountOpen(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t.deleteAccount}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={() => router.push('/sign-in')}>
                {t.signIn}
              </Button>
              <Button onClick={() => router.push('/sign-up')}>
                {t.signUp}
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.profile}</DialogTitle>
            <DialogDescription>{t.manageProfileDescription}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6 py-1">
              <section
                className="space-y-3 rounded-lg border p-4"
                hidden={profileSection !== 'basic'}
              >
                <h3 className="font-medium">{t.basicInfo}</h3>
                <div className="space-y-2">
                  <Label>{t.avatar}</Label>
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        user?.image || '/placeholder.svg'
                      }
                      alt="avatar"
                      width={52}
                      height={52}
                      className="h-12 w-12 rounded-full border object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <Label
                      htmlFor="profile-avatar-input"
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                    >
                      <Camera className="h-4 w-4" />
                      {avatarUploading ? t.uploading : t.changeAvatar}
                    </Label>
                    <Input
                      id="profile-avatar-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={avatarUploading}
                      onChange={(e) => {
                        void updateAvatar(e.target.files?.[0])
                        e.currentTarget.value = ''
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t.firstName}</Label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.lastName}</Label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={saveProfile} disabled={profileSaving}>
                  {profileSaving ? t.saving : t.saveProfile}
                </Button>
              </section>

              <section
                className="space-y-3 rounded-lg border p-4"
                hidden={profileSection !== 'emails'}
              >
                <h3 className="font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t.emails}
                </h3>
                <div className="space-y-2">
                  {(user?.emailAddresses || []).map((email) => (
                    <div
                      key={email.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{email.emailAddress}</p>
                        <p className="text-muted-foreground text-xs">
                          {email.verification?.status === 'verified'
                            ? t.verified
                            : t.unverified}
                          {user?.primaryEmailAddressId === email.id
                            ? ` · ${t.primary}`
                            : ''}
                        </p>
                      </div>
                      {user?.primaryEmailAddressId !== email.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPrimaryEmail(email.id)}
                        >
                          {t.setPrimary}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={t.addEmailAddressPlaceholder}
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <Button onClick={addEmailAddress}>{t.add}</Button>
                </div>
              </section>

              <section
                className="space-y-3 rounded-lg border p-4"
                hidden={profileSection !== 'security'}
              >
                <h3 className="font-medium">Account security</h3>
                <div className="space-y-2">
                  <Label>Current password</Label>
                  <Input type="password" value={twoFactorPassword} onChange={(e) => setTwoFactorPassword(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={enableTwoFactor} disabled={twoFactorPending || twoFactorEnabled}>Enable 2FA</Button>
                  <Button variant="outline" onClick={disableTwoFactor} disabled={twoFactorPending || !twoFactorEnabled}>Disable 2FA</Button>
                  <Button variant="outline" onClick={() => router.push('/reset-password')}>Change password</Button>
                </div>
                <div className="space-y-2">
                  <Label>TOTP verification code</Label>
                  <InputOTP value={twoFactorCode} onChange={(value) => setTwoFactorCode(value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
                  <Button variant="outline" onClick={verifyTwoFactorSetup} disabled={twoFactorPending || twoFactorCode.length < 6}>Verify setup code</Button>
                </div>
              </section>

              <section
                className="space-y-3 rounded-lg border p-4"
                hidden={profileSection !== 'oauth'}
              >
                <h3 className="font-medium flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  OAuth
                </h3>
                {(user?.externalAccounts || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t.noConnectedOauthAccounts}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(user?.externalAccounts || []).map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{account.provider}</p>
                          <p className="text-muted-foreground text-xs">
                            {account.emailAddress || account.username || '-'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unlinkOAuth(account.id)}
                        >
                          {t.disconnect}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" onClick={() => user?.reload()}>
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  {t.refreshConnections}
                </Button>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteAccountConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteAccountConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-account-confirm-input">
              DELETE MY ACCOUNT
            </Label>
            <Input
              id="delete-account-confirm-input"
              value={deleteAccountConfirmText}
              onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void deleteAccount()
              }}
              disabled={
                isDeletingAccount ||
                deleteAccountConfirmText !== 'DELETE MY ACCOUNT'
              }
            >
              {isDeletingAccount ? t.deleting : t.confirmDeleteAccount}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteCloudOpen} onOpenChange={setDeleteCloudOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteCloudConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteCloudConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-cloud-confirm-input">
              DELETE CLOUD DATA
            </Label>
            <Input
              id="delete-cloud-confirm-input"
              value={deleteCloudConfirmText}
              onChange={(e) => setDeleteCloudConfirmText(e.target.value)}
              placeholder="DELETE CLOUD DATA"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (deleteCloudConfirmText !== 'DELETE CLOUD DATA') return
                void destroy().finally(() => {
                  setDeleteCloudOpen(false)
                  setDeleteCloudConfirmText('')
                })
              }}
              disabled={deleteCloudConfirmText !== 'DELETE CLOUD DATA'}
            >
              {t.confirmDeleteData}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.autoBackup}</DialogTitle>
            <DialogDescription>
              {enabled ? t.autoBackupStatusEnabled : t.autoBackupStatusDisabled}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {enabled ? (
              <Button variant="destructive" onClick={disableAutoBackup}>
                {t.disable}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setBackupOpen(false)
                  setSetPwdOpen(true)
                }}
              >
                {t.enable}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={setPwdOpen} onOpenChange={setSetPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.setEncryptionPassword}</DialogTitle>
            <DialogDescription>
              {t.setEncryptionPasswordDescription}
            </DialogDescription>
          </DialogHeader>
          <Label>{t.password}</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Label>{t.confirmPassword}</Label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button onClick={enable}>{t.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={unlockOpen}
        onOpenChange={(open) => {
          if (open) setUnlockOpen(true)
        }}
      >
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t.enterPasswordTitle}</DialogTitle>
            <DialogDescription>{t.enterPasswordDescription}</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={unlock} disabled={isUnlocking}>
              {isUnlocking ? (
                <span className="flex items-center">
                  <Spinner className="mr-2" />
                  {t.verifying}
                </span>
              ) : (
                t.confirm
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.changeEncryptionKey}</DialogTitle>
          </DialogHeader>
          <Label>{t.oldPassword}</Label>
          <Input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
          <Label>{t.newPassword}</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Label>{t.confirmNewPassword}</Label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button onClick={rotate}>{t.confirmChange}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
