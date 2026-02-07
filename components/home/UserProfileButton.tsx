"use client"

import { useEffect, useRef, useState } from "react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { useCalendar } from "@/components/context/CalendarContext"
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
              <div className="grid gap-2 sm:grid-cols-2">
                <Button id="settings-account-profile" variant="outline" onClick={() => setProfileOpen(true)}><CircleUser className="h-4 w-4 mr-2" />{t.profile}</Button>
                <Button id="settings-account-backup" variant="outline" onClick={() => setBackupOpen(true)}><CloudUpload className="h-4 w-4 mr-2" />{t.autoBackup}</Button>
                <Button id="settings-account-key" variant="outline" onClick={() => setRotateOpen(true)}><KeyRound className="h-4 w-4 mr-2" />{t.changeKey}</Button>
                <Button id="settings-account-delete" variant="destructive" onClick={destroy}><Trash2 className="h-4 w-4 mr-2" />{t.deleteData}</Button>
                <SignOutButton>
                  <Button id="settings-account-signout" variant="outline" className="sm:col-span-2"><LogOut className="h-4 w-4 mr-2" />{t.signOut}</Button>
                </SignOutButton>
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
              <section className="space-y-3 rounded-lg border p-4">
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

              <section className="space-y-3 rounded-lg border p-4">
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

              <section className="space-y-3 rounded-lg border p-4">
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
          <DialogFooter>
            <Button onClick={unlock}>{t.confirm}</Button>
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
