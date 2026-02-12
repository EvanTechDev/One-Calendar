"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { useCalendar } from "@/components/providers/calendar-context"
import { translations, useLanguage } from "@/lib/i18n"
import { useUser, SignOutButton } from "@clerk/nextjs"
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
import type { CalendarEvent } from "@/components/providers/calendar-context"

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
    if (value !== null) storage[key] = value
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
    if (value !== null) markEncryptedSnapshot(key, value)
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

export type UserProfileSection = "profile" | "backup" | "key" | "delete" | "signout"

type UserProfileButtonProps = {
  variant?: React.ComponentProps<typeof Button>["variant"]
  className?: string
  mode?: "dropdown" | "settings"
  onNavigateToSettings?: (section: UserProfileSection) => void
  focusSection?: UserProfileSection | null
}

export default function UserProfileButton({
  variant = "ghost",
  className = "",
  mode = "dropdown",
  onNavigateToSettings,
  focusSection = null,
}: UserProfileButtonProps) {
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
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [restoreStep, setRestoreStep] = useState<"verify" | "upload">("verify")
  const [isReverifying, setIsReverifying] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreJsonPassword, setRestoreJsonPassword] = useState("")
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState("")
  const [profileSection, setProfileSection] = useState<"basic" | "emails" | "oauth">("basic")

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [oldPassword, setOldPassword] = useState("")
  const [error, setError] = useState("")

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const keyRef = useRef<string | null>(null)
  const restoredRef = useRef(false)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    if (mode !== "settings" || !focusSection) return
    const target = document.getElementById(`settings-account-${focusSection}`)
    target?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [focusSection, mode])

  useEffect(() => {
    if (!deleteAccountOpen) {
      setDeleteAccountConfirmText("")
    }
  }, [deleteAccountOpen])

  useEffect(() => {
    setEnabled(localStorage.getItem(AUTO_KEY) === "true")
  }, [])

  useEffect(() => {
    if (!user) return
    setFirstName(user.firstName || "")
    setLastName(user.lastName || "")
  }, [user])

  useEffect(() => {
    if (mode === "settings") return
    if (!isSignedIn || keyRef.current || restoredRef.current) return
    apiGet().then((cloud) => {
      if (cloud) setUnlockOpen(true)
    })
  }, [isSignedIn, mode])

  useEffect(() => {
    if (!enabled || !keyRef.current || !restoredRef.current) return
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

  async function saveProfile() {
    if (!user) return
    try {
      setProfileSaving(true)
      await user.update({
        firstName: firstName || null,
        lastName: lastName || null,
      })
      toast(language.startsWith("zh") ? "个人资料已更新" : "Profile updated")
    } catch (e: any) {
      toast(language.startsWith("zh") ? "更新失败" : "Failed to update profile", {
        description: e?.errors?.[0]?.longMessage || e?.message || "",
      })
    } finally {
      setProfileSaving(false)
    }
  }

  async function updateAvatar(file?: File | null) {
    if (!user || !file) return
    try {
      setAvatarUploading(true)
      await user.setProfileImage({ file })
      await user.reload()
      toast(language.startsWith("zh") ? "头像已更新" : "Avatar updated")
    } catch (e: any) {
      toast(language.startsWith("zh") ? "头像更新失败" : "Failed to update avatar", {
        description: e?.errors?.[0]?.longMessage || e?.message || "",
      })
    } finally {
      setAvatarUploading(false)
    }
  }

  async function addEmailAddress() {
    if (!user || !newEmail) return
    try {
      const email = await user.createEmailAddress({ email: newEmail })
      await email.prepareVerification({ strategy: "email_code" })
      setNewEmail("")
      toast(language.startsWith("zh") ? "已添加邮箱，请查收验证码" : "Email added. Check your inbox for verification")
      await user.reload()
    } catch (e: any) {
      toast(language.startsWith("zh") ? "添加邮箱失败" : "Failed to add email", {
        description: e?.errors?.[0]?.longMessage || e?.message || "",
      })
    }
  }

  async function setPrimaryEmail(emailId: string) {
    if (!user) return
    try {
      await user.update({ primaryEmailAddressId: emailId })
      toast(language.startsWith("zh") ? "主邮箱已更新" : "Primary email updated")
      await user.reload()
    } catch (e: any) {
      toast(language.startsWith("zh") ? "更新主邮箱失败" : "Failed to update primary email", {
        description: e?.errors?.[0]?.longMessage || e?.message || "",
      })
    }
  }

  async function unlinkOAuth(accountId: string) {
    if (!user) return
    try {
      const target = user.externalAccounts.find((acc) => acc.id === accountId)
      if (!target) return
      await target.destroy()
      toast(language.startsWith("zh") ? "OAuth 账号已断开" : "OAuth account disconnected")
      await user.reload()
    } catch (e: any) {
      toast(language.startsWith("zh") ? "断开失败" : "Failed to disconnect", {
        description: e?.errors?.[0]?.longMessage || e?.message || "",
      })
    }
  }

  const isZh = useMemo(() => language.startsWith("zh"), [language])

  const hydrateEvent = (raw: any): CalendarEvent => {
    const startDate = raw?.startDate ? new Date(raw.startDate) : new Date()
    const endDate = raw?.endDate ? new Date(raw.endDate) : new Date(startDate.getTime() + 60 * 60 * 1000)

    return {
      id: raw?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: raw?.title || (isZh ? "未命名日程" : "Unnamed Event"),
      startDate,
      endDate: endDate < startDate ? new Date(startDate.getTime() + 60 * 60 * 1000) : endDate,
      isAllDay: Boolean(raw?.isAllDay),
      recurrence: ["none", "daily", "weekly", "monthly", "yearly"].includes(raw?.recurrence)
        ? raw.recurrence
        : "none",
      location: raw?.location,
      participants: Array.isArray(raw?.participants) ? raw.participants : [],
      notification: typeof raw?.notification === "number" ? raw.notification : 0,
      description: raw?.description,
      color: raw?.color || "bg-blue-500",
      calendarId: raw?.calendarId || "1",
    }
  }

  const parseICSBackup = (icsContent: string): CalendarEvent[] => {
    const events: CalendarEvent[] = []
    const lines = icsContent.split(/\r\n|\n|\r/)
    let inEvent = false
    let current: any = {}

    for (const line of lines) {
      if (line.startsWith("BEGIN:VEVENT")) {
        inEvent = true
        current = {}
        continue
      }
      if (line.startsWith("END:VEVENT")) {
        if (inEvent) events.push(hydrateEvent(current))
        inEvent = false
        current = {}
        continue
      }
      if (!inEvent) continue

      const i = line.indexOf(":")
      if (i < 0) continue
      const key = line.slice(0, i).split(";")[0]
      const value = line.slice(i + 1)

      if (key === "SUMMARY") current.title = value
      if (key === "DESCRIPTION") current.description = value.replace(/\\n/g, "\n")
      if (key === "LOCATION") current.location = value
      if (key === "UID") current.id = value
      if (key === "DTSTART") current.startDate = value.endsWith("Z") ? new Date(value.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z")) : new Date(value)
      if (key === "DTEND") current.endDate = value.endsWith("Z") ? new Date(value.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z")) : new Date(value)
    }

    return events
  }

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let insideQuotes = false
    let currentValue = ""

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (i < line.length - 1 && line[i + 1] === '"') {
          currentValue += '"'
          i++
        } else {
          insideQuotes = !insideQuotes
        }
      } else if (char === "," && !insideQuotes) {
        result.push(currentValue.trim())
        currentValue = ""
      } else {
        currentValue += char
      }
    }

    result.push(currentValue.trim())
    return result
  }

  const parseCSVBackup = (csvContent: string): CalendarEvent[] => {
    const lines = csvContent.split("\n").filter((l) => l.trim())
    if (lines.length < 2) return []
    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase())

    return lines.slice(1).map((line) => {
      const values = parseCSVLine(line)
      const map: Record<string, string> = {}
      headers.forEach((h, i) => {
        map[h] = values[i] || ""
      })
      return hydrateEvent({
        title: map["title"],
        startDate: map["start date"] || map["start"],
        endDate: map["end date"] || map["end"],
        location: map["location"],
        description: map["description"],
        color: map["color"],
      })
    })
  }

  const parseJSONBackup = async (raw: string) => {
    const parsed = JSON.parse(raw)

    if (isEncryptedPayload(parsed) || parsed?.encrypted) {
      if (!restoreJsonPassword.trim()) {
        throw new Error(isZh ? "请输入 JSON 备份密码" : "Please enter the JSON backup password")
      }
      if (!isEncryptedPayload(parsed)) {
        throw new Error(isZh ? "JSON 备份格式无效" : "Invalid JSON backup format")
      }
      const plain = await decryptPayload(restoreJsonPassword, parsed.ciphertext, parsed.iv)
      const decrypted = JSON.parse(plain)
      if (!Array.isArray(decrypted)) {
        throw new Error(isZh ? "JSON 备份格式无效" : "Invalid JSON backup format")
      }
      return decrypted.map(hydrateEvent)
    }

    if (Array.isArray(parsed)) {
      return parsed.map(hydrateEvent)
    }

    throw new Error(isZh ? "JSON 备份格式无效" : "Invalid JSON backup format")
  }

  const resetRestoreFlow = () => {
    setRestoreStep("verify")
    setRestoreFile(null)
    setRestoreJsonPassword("")
  }

  const goBackToUnlock = () => {
    setForgotOpen(false)
    resetRestoreFlow()
    setUnlockOpen(true)
  }

  const restoreFromBackupFile = async () => {
    if (!restoreFile) {
      toast(isZh ? "请先选择备份文件" : "Please choose a backup file first", { variant: "destructive" })
      return
    }

    try {
      setIsRestoring(true)
      const ext = restoreFile.name.split(".").pop()?.toLowerCase()
      const content = await restoreFile.text()

      let restoredEvents: CalendarEvent[] = []
      if (ext === "ics") {
        restoredEvents = parseICSBackup(content)
      } else if (ext === "json") {
        restoredEvents = await parseJSONBackup(content)
      } else if (ext === "csv") {
        restoredEvents = parseCSVBackup(content)
      } else {
        throw new Error(isZh ? "不支持的备份格式" : "Unsupported backup format")
      }

      if (restoredEvents.length === 0) {
        throw new Error(isZh ? "备份中未解析到事件" : "No events found in backup file")
      }

      setEvents(restoredEvents)
      localStorage.setItem("calendar-events", JSON.stringify(restoredEvents))
      clearEncryptionPassword()
      keyRef.current = null
      restoredRef.current = false
      setEnabled(false)
      localStorage.removeItem(AUTO_KEY)

      setForgotOpen(false)
      setUnlockOpen(false)
      resetRestoreFlow()
      setPassword("")
      toast(isZh ? "已从备份恢复数据" : "Data restored from backup")
    } catch (e: any) {
      toast(isZh ? "恢复失败" : "Restore failed", {
        description: e?.message || "",
        variant: "destructive",
      })
    } finally {
      setIsRestoring(false)
    }
  }

  const startForgotRecovery = async () => {
    try {
      setIsReverifying(true)
      await startReverification()
      setRestoreStep("upload")
    } catch (e: any) {
      toast(isZh ? "验证失败" : "Reverification failed", {
        description: e?.errors?.[0]?.longMessage || e?.message || "",
        variant: "destructive",
      })
    } finally {
      setIsReverifying(false)
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
    await encryptLocalStorage(password)
    const payload = await encryptPayload(password, JSON.stringify({ v: BACKUP_VERSION, storage: collectLocalStorage() }))
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
    const next = await encryptPayload(password, JSON.stringify({ v: BACKUP_VERSION, storage: collectLocalStorage() }))
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

  const openProfileSection = (section: "basic" | "emails" | "oauth") => {
    setProfileSection(section)
    setProfileOpen(true)
  }

  async function deleteAccount() {
    if (!user || deleteAccountConfirmText !== "DELETE MY ACCOUNT") return
    try {
      setIsDeletingAccount(true)
      const response = await fetch("/api/account", { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to delete account data")
      }

      await user.delete()

      toast(language.startsWith("zh") ? "账号已删除" : "Account deleted")
      router.replace("/")
    } catch (e: any) {
      toast(language.startsWith("zh") ? "删除账号失败" : "Failed to delete account", {
        description: e?.message || "",
      })
    } finally {
      setIsDeletingAccount(false)
      setDeleteAccountOpen(false)
    }
  }

  return (
    <>
      {mode === "dropdown" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isSignedIn && user?.imageUrl ? (
              <Button variant="ghost" size="icon" className="rounded-full overflow-hidden h-8 w-8 p-0">
                <Image src={user.imageUrl} alt="avatar" width={32} height={32} className="rounded-full object-cover" />
              </Button>
            ) : (
              <Button variant={variant} size="icon" className={`rounded-full h-10 w-10 ${className}`}>
                <User className="h-5 w-5" />
              </Button>
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            {isSignedIn ? (
              <>
                <DropdownMenuItem onClick={() => onNavigateToSettings ? onNavigateToSettings("profile") : setProfileOpen(true)}>
                  <CircleUser className="mr-2 h-4 w-4" />
                  {t.profile}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => onNavigateToSettings ? onNavigateToSettings("backup") : setBackupOpen(true)}>
                  <CloudUpload className="mr-2 h-4 w-4" />
                  {t.autoBackup}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => onNavigateToSettings ? onNavigateToSettings("key") : setRotateOpen(true)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  {t.changeKey}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => onNavigateToSettings ? onNavigateToSettings("delete") : destroy()}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t.deleteData}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => setDeleteAccountOpen(true)} className="text-red-600 focus:text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {language.startsWith("zh") ? "删除账号" : "Delete account"}
                </DropdownMenuItem>

                {onNavigateToSettings ? (
                  <DropdownMenuItem onClick={() => onNavigateToSettings("signout")}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t.signOut}
                  </DropdownMenuItem>
                ) : (
                  <SignOutButton>
                    <DropdownMenuItem>
                      <LogOut className="mr-2 h-4 w-4" />
                      {t.signOut}
                    </DropdownMenuItem>
                  </SignOutButton>
                )}
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => router.push("/sign-in")}>{t.signIn}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/sign-up")}>{t.signUp}</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="rounded-lg border p-4 space-y-4">
          {isSignedIn ? (
            <>
              <div className="flex items-center gap-3">
                <Image
                  src={user?.imageUrl || "/placeholder.svg"}
                  alt="avatar"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full border object-cover"
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "User"}</p>
                  <p className="text-sm text-muted-foreground truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-semibold">{language.startsWith("zh") ? "基本信息" : "Basic info"}</p>
                  <p className="text-xs text-muted-foreground">{language.startsWith("zh") ? "编辑头像与姓名等个人资料信息。" : "Edit your avatar and personal profile details."}</p>
                  <Button id="settings-account-profile" variant="outline" onClick={() => openProfileSection("basic")}><CircleUser className="h-4 w-4 mr-2" />{language.startsWith("zh") ? "打开基本信息" : "Open basic info"}</Button>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-semibold">{language.startsWith("zh") ? "邮箱管理" : "Email management"}</p>
                  <p className="text-xs text-muted-foreground">{language.startsWith("zh") ? "查看、添加并管理您的邮箱地址。" : "View, add, and manage your email addresses."}</p>
                  <Button variant="outline" onClick={() => openProfileSection("emails")}><Mail className="h-4 w-4 mr-2" />{language.startsWith("zh") ? "打开邮箱设置" : "Open email settings"}</Button>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-semibold">OAuth</p>
                  <p className="text-xs text-muted-foreground">{language.startsWith("zh") ? "查看和管理已绑定的第三方登录账号。" : "View and manage connected third-party login providers."}</p>
                  <Button variant="outline" onClick={() => openProfileSection("oauth")}><LinkIcon className="h-4 w-4 mr-2" />{language.startsWith("zh") ? "打开 OAuth 设置" : "Open OAuth settings"}</Button>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-semibold">{t.autoBackup}</p>
                  <p className="text-xs text-muted-foreground">{language.startsWith("zh") ? "配置自动备份，防止本地数据意外丢失。" : "Configure automatic backups to avoid accidental local data loss."}</p>
                  <Button id="settings-account-backup" variant="outline" onClick={() => setBackupOpen(true)}><CloudUpload className="h-4 w-4 mr-2" />{language.startsWith("zh") ? "打开备份设置" : "Open backup settings"}</Button>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-semibold">{t.changeKey}</p>
                  <p className="text-xs text-muted-foreground">{language.startsWith("zh") ? "更新加密密钥，提升备份安全性。" : "Rotate your encryption key to improve backup security."}</p>
                  <Button id="settings-account-key" variant="outline" onClick={() => setRotateOpen(true)}><KeyRound className="h-4 w-4 mr-2" />{language.startsWith("zh") ? "更改加密密钥" : "Change encryption key"}</Button>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-semibold">{t.signOut}</p>
                  <p className="text-xs text-muted-foreground">{language.startsWith("zh") ? "退出当前账号并返回登录页。" : "Sign out of your account and return to sign-in."}</p>
                  <SignOutButton>
                    <Button id="settings-account-signout" variant="outline"><LogOut className="h-4 w-4 mr-2" />{t.signOut}</Button>
                  </SignOutButton>
                </div>

                <div className="rounded-md border border-destructive/40 p-3 space-y-3">
                  <p className="text-sm font-semibold text-destructive">Danger Zone</p>
                  <div className="space-y-3 rounded-md border border-destructive/20 p-3">
                    <p className="text-sm font-semibold text-destructive">{t.deleteData}</p>
                    <p className="text-xs text-muted-foreground">{language.startsWith("zh") ? "删除当前账号下的本地与云端日历数据。" : "Delete calendar data stored locally and in the cloud for this account."}</p>
                    <Button id="settings-account-delete" variant="destructive" onClick={destroy}><Trash2 className="h-4 w-4 mr-2" />{t.deleteData}</Button>
                  </div>
                  <div className="space-y-3 rounded-md border border-destructive/20 p-3">
                    <p className="text-sm font-semibold text-destructive">{language.startsWith("zh") ? "删除账号" : "Delete account"}</p>
                    <p className="text-xs text-muted-foreground">{language.startsWith("zh") ? "永久删除 Clerk 账号及关联数据，无法恢复。" : "Permanently remove your Clerk account and related data."}</p>
                    <Button variant="destructive" onClick={() => setDeleteAccountOpen(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {language.startsWith("zh") ? "删除账号" : "Delete account"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={() => router.push("/sign-in")}>{t.signIn}</Button>
              <Button onClick={() => router.push("/sign-up")}>{t.signUp}</Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{language.startsWith("zh") ? "个人资料" : "Profile"}</DialogTitle>
            <DialogDescription>
              {language.startsWith("zh")
                ? "管理名称、邮箱和 OAuth 连接。"
                : "Manage your name, email addresses, and OAuth connections."}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6 py-1">
              <section className="space-y-3 rounded-lg border p-4" hidden={profileSection !== "basic"}>
                <h3 className="font-medium">{language.startsWith("zh") ? "基本信息" : "Basic info"}</h3>
                <div className="space-y-2">
                  <Label>{language.startsWith("zh") ? "头像" : "Avatar"}</Label>
                  <div className="flex items-center gap-3">
                    <Image
                      src={user?.imageUrl || "/placeholder.svg"}
                      alt="avatar"
                      width={52}
                      height={52}
                      className="h-12 w-12 rounded-full border object-cover"
                    />
                    <Label
                      htmlFor="profile-avatar-input"
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                    >
                      <Camera className="h-4 w-4" />
                      {avatarUploading
                        ? language.startsWith("zh")
                          ? "上传中..."
                          : "Uploading..."
                        : language.startsWith("zh")
                          ? "更换头像"
                          : "Change avatar"}
                    </Label>
                    <Input
                      id="profile-avatar-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={avatarUploading}
                      onChange={(e) => {
                        void updateAvatar(e.target.files?.[0])
                        e.currentTarget.value = ""
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{language.startsWith("zh") ? "名字" : "First name"}</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{language.startsWith("zh") ? "姓氏" : "Last name"}</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <Button onClick={saveProfile} disabled={profileSaving}>
                  {profileSaving
                    ? language.startsWith("zh")
                      ? "保存中..."
                      : "Saving..."
                    : language.startsWith("zh")
                      ? "保存资料"
                      : "Save profile"}
                </Button>
              </section>

              <section className="space-y-3 rounded-lg border p-4" hidden={profileSection !== "emails"}>
                <h3 className="font-medium flex items-center gap-2"><Mail className="h-4 w-4" />{language.startsWith("zh") ? "邮箱" : "Emails"}</h3>
                <div className="space-y-2">
                  {(user?.emailAddresses || []).map((email) => (
                    <div key={email.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{email.emailAddress}</p>
                        <p className="text-muted-foreground text-xs">
                          {email.verification?.status === "verified"
                            ? language.startsWith("zh") ? "已验证" : "Verified"
                            : language.startsWith("zh") ? "未验证" : "Unverified"}
                          {user?.primaryEmailAddressId === email.id
                            ? ` · ${language.startsWith("zh") ? "主邮箱" : "Primary"}`
                            : ""}
                        </p>
                      </div>
                      {user?.primaryEmailAddressId !== email.id && (
                        <Button variant="outline" size="sm" onClick={() => setPrimaryEmail(email.id)}>
                          {language.startsWith("zh") ? "设为主邮箱" : "Set primary"}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={language.startsWith("zh") ? "新增邮箱" : "Add email address"}
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <Button onClick={addEmailAddress}>{language.startsWith("zh") ? "添加" : "Add"}</Button>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border p-4" hidden={profileSection !== "oauth"}>
                <h3 className="font-medium flex items-center gap-2"><LinkIcon className="h-4 w-4" />OAuth</h3>
                {(user?.externalAccounts || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {language.startsWith("zh") ? "暂无已连接 OAuth 账号" : "No connected OAuth accounts"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(user?.externalAccounts || []).map((account) => (
                      <div key={account.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">{account.provider}</p>
                          <p className="text-muted-foreground text-xs">{account.emailAddress || account.username || "-"}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => unlinkOAuth(account.id)}>
                          {language.startsWith("zh") ? "断开" : "Disconnect"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" onClick={() => user?.reload()}>
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  {language.startsWith("zh") ? "刷新连接状态" : "Refresh connections"}
                </Button>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language.startsWith("zh") ? "确认删除账号？" : "Delete your account?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language.startsWith("zh")
                ? "此操作不可撤销。将删除你的账号，以及该用户的 calendar_events、shares 和备份数据。请输入 DELETE MY ACCOUNT 继续。"
                : "This action cannot be undone. It deletes your account and removes your calendar_events, shares, and backups. Type DELETE MY ACCOUNT to continue."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-account-confirm-input">DELETE MY ACCOUNT</Label>
            <Input
              id="delete-account-confirm-input"
              value={deleteAccountConfirmText}
              onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{language.startsWith("zh") ? "取消" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void deleteAccount()
              }}
              disabled={isDeletingAccount || deleteAccountConfirmText !== "DELETE MY ACCOUNT"}
            >
              {isDeletingAccount
                ? language.startsWith("zh")
                  ? "删除中..."
                  : "Deleting..."
                : language.startsWith("zh")
                  ? "确认删除"
                  : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.autoBackup}</DialogTitle>
            <DialogDescription>{enabled ? t.autoBackupStatusEnabled : t.autoBackupStatusDisabled}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {enabled ? (
              <Button variant="destructive" onClick={disableAutoBackup}>{t.disable}</Button>
            ) : (
              <Button onClick={() => { setBackupOpen(false); setSetPwdOpen(true) }}>{t.enable}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={setPwdOpen} onOpenChange={setSetPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.setEncryptionPassword}</DialogTitle>
            <DialogDescription>{t.setEncryptionPasswordDescription}</DialogDescription>
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

      <Dialog open={unlockOpen} onOpenChange={(open) => { if (open) setUnlockOpen(true) }}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t.enterPasswordTitle}</DialogTitle>
            <DialogDescription>{t.enterPasswordDescription}</DialogDescription>
          </DialogHeader>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button
            type="button"
            className="text-left text-xs text-blue-600 hover:underline"
            onClick={() => {
              setUnlockOpen(false)
              setRestoreStep("verify")
              setForgotOpen(true)
            }}
          >
            {isZh ? "忘记加密密钥？从备份恢复" : "Forgot encryption key? Restore from backup"}
          </button>
          <DialogFooter>
            <Button onClick={unlock} disabled={isUnlocking}>
              {isUnlocking ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {language.startsWith("zh") ? "验证中..." : "Verifying..."}
                </span>
              ) : (
                t.confirm
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog
        open={forgotOpen}
        onOpenChange={(open) => {
          setForgotOpen(open)
          if (!open) resetRestoreFlow()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isZh ? "从备份恢复数据" : "Restore from backup"}</DialogTitle>
            <DialogDescription>
              {restoreStep === "verify"
                ? (isZh ? "继续前请确认您要通过备份恢复数据。" : "Please confirm you want to restore your data from a backup before continuing.")
                : (isZh ? "上传 .ics、.json 或 .csv 备份文件恢复数据。" : "Upload a .ics, .json, or .csv backup file to restore your data.")}
            </DialogDescription>
          </DialogHeader>

          {restoreStep === "verify" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {isZh ? "继续后，您可以上传备份文件恢复日历数据。" : "After continuing, you can upload a backup file to restore calendar data."}
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={goBackToUnlock}>
                  {t.cancel}
                </Button>
                <Button onClick={startForgotRecovery} disabled={isReverifying}>
                  {isReverifying ? (isZh ? "处理中..." : "Processing...") : (isZh ? "继续" : "Continue")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="restore-file">{isZh ? "备份文件" : "Backup file"}</Label>
                <Input
                  id="restore-file"
                  type="file"
                  accept=".ics,.json,.csv"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">{isZh ? "支持 .ics、.json、.csv" : "Supported: .ics, .json, .csv"}</p>
              </div>

              {restoreFile?.name.toLowerCase().endsWith(".json") && (
                <div className="space-y-2">
                  <Label htmlFor="restore-json-password">{isZh ? "JSON 备份密码（如有）" : "JSON backup password (if encrypted)"}</Label>
                  <Input
                    id="restore-json-password"
                    type="password"
                    value={restoreJsonPassword}
                    onChange={(e) => setRestoreJsonPassword(e.target.value)}
                    placeholder={isZh ? "如果 JSON 已加密，请输入密码" : "Enter password if JSON backup is encrypted"}
                  />
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={goBackToUnlock}>
                  {t.cancel}
                </Button>
                <Button onClick={restoreFromBackupFile} disabled={isRestoring || !restoreFile}>
                  {isRestoring ? (isZh ? "恢复中..." : "Restoring...") : (isZh ? "恢复数据" : "Restore data")}
                </Button>
              </DialogFooter>
            </div>
          )}
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
