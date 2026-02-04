
"use client"

import { useEffect, useRef, useState } from "react"
import {
  User,
  LogOut,
  CircleUser,
  FolderSync,
  CloudUpload,
  Trash2,
  KeyRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useCalendar } from "@/components/context/CalendarContext"
import { translations, useLanguage } from "@/lib/i18n"
import { useUser, SignOutButton, UserProfile } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { decryptPayload, encryptPayload, isEncryptedPayload } from "@/lib/crypto"
import {
  clearEncryptionPassword,
  encryptSnapshots,
  markEncryptedSnapshot,
  persistEncryptedSnapshots,
  readEncryptedLocalStorage,
  setEncryptionPassword,
} from "@/hooks/useLocalStorage"

const AUTO_KEY = "auto-backup-enabled"
const BACKUP_VERSION = 1
const BACKUP_KEYS = [
  "calendar-events",
  "calendar-categories",
  "bookmarked-events",
  "shared-events",
  "countdowns",
  "first-day-of-week",
  "timezone",
  "notification-sound",
  "default-view",
  "enable-shortcuts",
  "preferred-language",
  "skip-landing",
  "today-toast",
]

async function apiGet() {
  const r = await fetch("/api/blob")
  if (r.status === 404) return null
  if (!r.ok) throw new Error()
  return r.json()
}

async function apiPost(body: any) {
  const r = await fetch("/api/blob", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error()
}

async function apiDelete() {
  const r = await fetch("/api/blob", { method: "DELETE" })
  if (!r.ok) throw new Error()
}

function collectLocalStorage() {
  const storage: Record<string, string> = {}
  BACKUP_KEYS.forEach((key) => {
    const value = localStorage.getItem(key)
    if (value !== null) {
      storage[key] = value
    }
  })
  return storage
}

function applyLocalStorage(storage: Record<string, string>) {
  Object.entries(storage).forEach(([key, value]) => {
    localStorage.setItem(key, value)
    markEncryptedSnapshot(key, value)
  })
}

async function encryptLocalStorage(password: string) {
  BACKUP_KEYS.forEach((key) => {
    const value = localStorage.getItem(key)
    if (value !== null) {
      markEncryptedSnapshot(key, value)
    }
  })
  await encryptSnapshots(password)
  await persistEncryptedSnapshots()
}

async function decryptLocalStorage(password: string) {
  await Promise.all(
    BACKUP_KEYS.map(async (key) => {
      const value = localStorage.getItem(key)
      if (!value) return
      try {
        const parsed = JSON.parse(value)
        if (isEncryptedPayload(parsed)) {
          const plain = await decryptPayload(password, parsed.ciphertext, parsed.iv)
          localStorage.setItem(key, plain)
          markEncryptedSnapshot(key, plain)
        } else {
          markEncryptedSnapshot(key, value)
        }
      } catch {
        markEncryptedSnapshot(key, value)
      }
    }),
  )
}

async function reencryptLocalStorage(oldPassword: string, newPassword: string) {
  await Promise.all(
    BACKUP_KEYS.map(async (key) => {
      const value = localStorage.getItem(key)
      if (!value) return
      try {
        const parsed = JSON.parse(value)
        if (isEncryptedPayload(parsed)) {
          const plain = await decryptPayload(oldPassword, parsed.ciphertext, parsed.iv)
          markEncryptedSnapshot(key, plain)
        } else {
          markEncryptedSnapshot(key, value)
        }
      } catch {
        markEncryptedSnapshot(key, value)
      }
    }),
  )
  await encryptSnapshots(newPassword)
  await persistEncryptedSnapshots()
}

export default function UserProfileButton() {
  const [language] = useLanguage()
  const t = translations[language]
  const { events, calendars, setEvents, setCalendars } = useCalendar()
  const { user, isSignedIn } = useUser()
  const router = useRouter()

  const [enabled, setEnabled] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [setPwdOpen, setSetPwdOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [oldPassword, setOldPassword] = useState("")
  const [error, setError] = useState("")

  const keyRef = useRef<string | null>(null)
  const restoredRef = useRef(false)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    setEnabled(localStorage.getItem(AUTO_KEY) === "true")
  }, [])

  useEffect(() => {
    if (!isSignedIn) return
    if (keyRef.current) return
    if (restoredRef.current) return

    apiGet().then((cloud) => {
      if (cloud) setUnlockOpen(true)
    })
  }, [isSignedIn])

  useEffect(() => {
    if (!enabled) return
    if (!keyRef.current) return
    if (!restoredRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      const payload = await encryptPayload(
        keyRef.current!,
        JSON.stringify({ v: BACKUP_VERSION, storage: collectLocalStorage() }),
      )
      await apiPost(payload)
      timerRef.current = null
    }, 800)
  }, [events, calendars, enabled])

  async function unlock() {
    if (!password) return

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
        applyLocalStorage(data.storage)
      } else if (data?.events || data?.calendars) {
        const fallbackStorage: Record<string, string> = {}
        if (data?.events) fallbackStorage["calendar-events"] = JSON.stringify(data.events)
        if (data?.calendars) fallbackStorage["calendar-categories"] = JSON.stringify(data.calendars)
        applyLocalStorage(fallbackStorage)
      }
      await setEncryptionPassword(password)
      const restoredEvents = await readEncryptedLocalStorage("calendar-events", [])
      const restoredCalendars = await readEncryptedLocalStorage("calendar-categories", [])
      setEvents(restoredEvents)
      setCalendars(restoredCalendars)
    } catch {}

    keyRef.current = password
    restoredRef.current = true
    localStorage.setItem(AUTO_KEY, "true")
    setEnabled(true)

    setPassword("")
    setUnlockOpen(false)

    toast(t.dataRestoredAutoBackupEnabled)
  }

  async function enable() {
    if (password !== confirm) {
      setError(t.passwordsDoNotMatch)
      return
    }
    await setEncryptionPassword(password)
    await encryptLocalStorage(password)
    const payload = await encryptPayload(
      password,
      JSON.stringify({ v: BACKUP_VERSION, storage: collectLocalStorage() }),
    )
    await apiPost(payload)
    localStorage.setItem(AUTO_KEY, "true")
    keyRef.current = password
    restoredRef.current = true
    setEnabled(true)
    setPassword("")
    setConfirm("")
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

    await reencryptLocalStorage(oldPassword, password)
    const next = await encryptPayload(
      password,
      JSON.stringify({ v: BACKUP_VERSION, storage: collectLocalStorage() }),
    )
    await apiPost(next)
    await setEncryptionPassword(password)
    keyRef.current = password
    setRotateOpen(false)
    setOldPassword("")
    setPassword("")
    setConfirm("")
    toast(t.encryptionKeyUpdated)
  }

  function disableAutoBackup() {
    const currentPassword = keyRef.current
    localStorage.removeItem(AUTO_KEY)
    keyRef.current = null
    restoredRef.current = false
    setEnabled(false)
    if (currentPassword) {
      void decryptLocalStorage(currentPassword)
    }
    clearEncryptionPassword()
    toast(t.autoBackupDisabled)
  }

  async function destroy() {
    await apiDelete()
    localStorage.removeItem(AUTO_KEY)
    keyRef.current = null
    restoredRef.current = false
    setEnabled(false)
    toast(t.cloudDataDeleted)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {isSignedIn && user?.imageUrl ? (
            <Button variant="ghost" size="icon" className="rounded-full overflow-hidden h-8 w-8 p-0">
              <Image
                src={user.imageUrl}
                alt="avatar"
                width={32}
                height={32}
                className="rounded-full object-cover"
              />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
              <User className="h-5 w-5" />
            </Button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {isSignedIn ? (
            <>
              <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                <CircleUser className="mr-2 h-4 w-4" />
                {t.profile}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setBackupOpen(true)}>
                <CloudUpload className="mr-2 h-4 w-4" />
                {t.autoBackup}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setRotateOpen(true)}>
                <KeyRound className="mr-2 h-4 w-4" />
                {t.changeKey}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={destroy}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t.deleteData}
              </DropdownMenuItem>

              <SignOutButton>
                <DropdownMenuItem>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t.signOut}
                </DropdownMenuItem>
              </SignOutButton>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={() => router.push("/sign-in")}>
                {t.signIn}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/sign-up")}>
                {t.signUp}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="p-0 w-auto">
          <UserProfile />
        </DialogContent>
      </Dialog>

      <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.autoBackup}</DialogTitle>
            <DialogDescription>
              {enabled
                ? t.autoBackupStatusEnabled
                : t.autoBackupStatusDisabled}
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
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Label>{t.confirmPassword}</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button onClick={enable}>{t.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
  open={unlockOpen}
  onOpenChange={(open) => {
    if (open) {
      setUnlockOpen(true)
    }
  }}
>
  <DialogContent
    onInteractOutside={(e) => e.preventDefault()}
    onEscapeKeyDown={(e) => e.preventDefault()}
  >
    <DialogHeader>
      <DialogTitle>
        {t.enterPasswordTitle}
      </DialogTitle>
      <DialogDescription>
        {t.enterPasswordDescription}
      </DialogDescription>
    </DialogHeader>

    <Input
      type="password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
    />

    <DialogFooter>
      <Button onClick={unlock}>
        {t.confirm}
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
          <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
          <Label>{t.newPassword}</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Label>{t.confirmNewPassword}</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button onClick={rotate}>{t.confirmChange}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
