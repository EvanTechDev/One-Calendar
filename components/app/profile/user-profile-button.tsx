'use client'

import { useEffect, useState } from 'react'
import {
  BarChart2,
  CircleUser,
  CloudUpload,
  LogOut,
  Settings,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { useCalendar } from '@/components/providers/calendar-context'
import { translations, useLanguage } from '@/lib/i18n'
import { authClient } from '@/lib/auth/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const AUTO_KEY = 'auto-backup-enabled'
const BACKUP_STATUS_KEY = 'auto-backup-sync-status'

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

async function apiDelete() {
  const response = await fetch('/api/blob', { method: 'DELETE' })
  if (!response.ok) throw new Error('Failed to delete cloud data')
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
  const { events, calendars } = useCalendar()
  const { data: session } = authClient.useSession()
  const user: any = session?.user
  const isSignedIn = Boolean(session?.user)
  const router = useRouter()

  const [enabled, setEnabled] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [deleteCloudOpen, setDeleteCloudOpen] = useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [deleteCloudConfirmText, setDeleteCloudConfirmText] = useState('')
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  useEffect(() => {
    setEnabled(localStorage.getItem(AUTO_KEY) === 'true')
  }, [])

  useEffect(() => {
    if (mode !== 'settings' || !focusSection) return
    document
      .getElementById(`settings-account-${focusSection}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusSection, mode])

  useEffect(() => {
    if (!user) return
    const fullName = (user.name || '').trim()
    const parts = fullName ? fullName.split(/\s+/) : []
    setFirstName(parts[0] || '')
    setLastName(parts.slice(1).join(' '))
  }, [user])

  function setBackupStatus(status: 'uploading' | 'failed' | 'done') {
    localStorage.setItem(BACKUP_STATUS_KEY, status)
    window.dispatchEvent(
      new CustomEvent('backup-status-change', { detail: { status } }),
    )
  }

  async function saveProfile() {
    if (!user) return
    try {
      setProfileSaving(true)
      const name = `${firstName} ${lastName}`.trim()
      const { error } = await authClient.updateUser({ name: name || undefined })
      if (error) throw new Error(error.message || 'Failed to update profile')
      toast(t.profileUpdated || 'Profile updated')
    } catch (error: any) {
      toast(t.profileUpdateFailed || 'Failed to update profile', {
        description: error?.message || '',
      })
    } finally {
      setProfileSaving(false)
    }
  }

  async function enableAutoBackup() {
    localStorage.setItem(AUTO_KEY, 'true')
    setEnabled(true)
    setBackupStatus('uploading')
    try {
      await fetch('/api/blob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events, calendars }),
      })
      setBackupStatus('done')
      toast(t.autoBackupEnabled || 'Server backup enabled')
    } catch {
      setBackupStatus('failed')
      toast(t.backupFailed || 'Backup failed')
    }
    setBackupOpen(false)
  }

  function disableAutoBackup() {
    localStorage.removeItem(AUTO_KEY)
    localStorage.removeItem(BACKUP_STATUS_KEY)
    setEnabled(false)
    window.dispatchEvent(new CustomEvent('backup-status-change'))
    toast(t.autoBackupDisabled || 'Server backup disabled')
  }

  async function destroyCloudData() {
    await apiDelete()
    localStorage.removeItem(AUTO_KEY)
    localStorage.removeItem(BACKUP_STATUS_KEY)
    setEnabled(false)
    window.dispatchEvent(new CustomEvent('backup-status-change'))
    toast(t.cloudDataDeleted || 'Cloud data deleted')
  }

  async function signOut() {
    await authClient.signOut()
    router.push('/sign-in')
  }

  async function deleteAccount() {
    await fetch('/api/account', { method: 'DELETE' })
    await authClient.signOut()
    router.push('/sign-in')
  }

  if (!isSignedIn && mode === 'dropdown') {
    return (
      <Button
        variant={variant}
        className={className}
        onClick={() => router.push('/sign-in')}
      >
        <CircleUser className="h-4 w-4" />
      </Button>
    )
  }

  const settingsContent = (
    <div className="grid gap-4 md:grid-cols-2">
      <section
        id="settings-account-profile"
        className="rounded-lg border bg-card p-4"
      >
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <CircleUser className="h-4 w-4" />
          {t.profile || 'Profile'}
        </div>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.firstName || 'First name'}</Label>
              <Input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.lastName || 'Last name'}</Label>
              <Input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </div>
          </div>
          <div className="text-sm text-muted-foreground">{user?.email}</div>
          <Button onClick={saveProfile} disabled={profileSaving}>
            {profileSaving ? t.saving || 'Saving' : t.save || 'Save'}
          </Button>
        </div>
      </section>

      <section
        id="settings-account-backup"
        className="rounded-lg border bg-card p-4"
      >
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <CloudUpload className="h-4 w-4" />
          {t.autoBackup || 'Server backup'}
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {enabled
            ? t.autoBackupStatusEnabled ||
              'Your calendar data is encrypted on the server.'
            : t.autoBackupStatusDisabled ||
              'Enable server-side encrypted calendar storage.'}
        </p>
        {enabled ? (
          <Button variant="outline" onClick={disableAutoBackup}>
            {t.disable || 'Disable'}
          </Button>
        ) : (
          <Button onClick={enableAutoBackup}>{t.enable || 'Enable'}</Button>
        )}
      </section>

      <section
        id="settings-account-delete"
        className="rounded-lg border bg-card p-4 md:col-span-2"
      >
        <div className="mb-3 flex items-center gap-2 font-semibold text-destructive">
          <Trash2 className="h-4 w-4" />
          {t.delete || 'Delete'}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            onClick={() => setDeleteCloudOpen(true)}
          >
            {t.deleteData || 'Delete cloud data'}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteAccountOpen(true)}
          >
            {t.deleteAccount || 'Delete account'}
          </Button>
        </div>
      </section>
    </div>
  )

  return (
    <>
      {mode === 'settings' ? (
        settingsContent
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={variant} className={cn(className)}>
              <CircleUser className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <CircleUser className="mr-2 h-4 w-4" />
              {t.profile || 'Profile'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                onNavigateToSettings?.('backup') ?? setBackupOpen(true)
              }
            >
              <CloudUpload className="mr-2 h-4 w-4" />
              {t.autoBackup || 'Server backup'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigateToView?.('analytics')}>
              <BarChart2 className="mr-2 h-4 w-4" />
              {t.analytics || 'Analytics'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                onNavigateToSettings?.('profile') ??
                onNavigateToView?.('settings')
              }
            >
              <Settings className="mr-2 h-4 w-4" />
              {t.settings || 'Settings'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={signOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t.signOut || 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.profile || 'Profile'}</DialogTitle>
            <DialogDescription>{user?.email}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-3">
            {settingsContent}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.autoBackup || 'Server backup'}</DialogTitle>
            <DialogDescription>
              {enabled
                ? t.autoBackupStatusEnabled || 'Server backup is enabled.'
                : t.autoBackupStatusDisabled || 'Server backup is disabled.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {enabled ? (
              <Button variant="destructive" onClick={disableAutoBackup}>
                {t.disable || 'Disable'}
              </Button>
            ) : (
              <Button onClick={enableAutoBackup}>{t.enable || 'Enable'}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteCloudOpen} onOpenChange={setDeleteCloudOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.deleteCloudConfirmTitle || 'Delete cloud data?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteCloudConfirmDescription ||
                'This permanently removes server-side calendar data.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>DELETE CLOUD DATA</Label>
            <Input
              value={deleteCloudConfirmText}
              onChange={(event) =>
                setDeleteCloudConfirmText(event.target.value)
              }
              placeholder="DELETE CLOUD DATA"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              disabled={deleteCloudConfirmText !== 'DELETE CLOUD DATA'}
              onClick={(event) => {
                event.preventDefault()
                void destroyCloudData().finally(() => {
                  setDeleteCloudOpen(false)
                  setDeleteCloudConfirmText('')
                })
              }}
            >
              {t.confirmDeleteData || 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.deleteAccount || 'Delete account'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteAccountConfirmDescription ||
                'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>DELETE ACCOUNT</Label>
            <Input
              value={deleteAccountConfirmText}
              onChange={(event) =>
                setDeleteAccountConfirmText(event.target.value)
              }
              placeholder="DELETE ACCOUNT"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              disabled={deleteAccountConfirmText !== 'DELETE ACCOUNT'}
              onClick={(event) => {
                event.preventDefault()
                void deleteAccount()
              }}
            >
              {t.confirmDeleteData || 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
