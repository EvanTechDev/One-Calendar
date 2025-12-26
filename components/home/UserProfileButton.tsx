
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { User, LogOut, CircleUser, FolderSync, CloudUpload, Trash2 } from "lucide-react"
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
import { SignOutButton, UserProfile, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Image from "next/image"

type EncryptedPayload = {
  v: 1
  salt: string
  iv: string
  ct: string
}

const AUTO_BACKUP_ENABLED_KEY = "auto-backup-enabled"
const AUTO_BACKUP_USER_KEY = "auto-backup-user"
const LOCAL_BACKUP_KEYS_CANDIDATES = ["calendar-backup", "backup", "calendar-data", "calendar_events", "calendar_calendars"]
const LOCAL_BACKUP_CHANGED_EVENT = "localstorage-changed"

function toBase64(bytes: Uint8Array) {
  let s = ""
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function fromBase64(b64: string) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function deriveAesKey(password: string, salt: Uint8Array) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

async function encryptString(password: string, plaintext: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveAesKey(password, salt)
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext))
  const payload: EncryptedPayload = {
    v: 1,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ctBuf)),
  }
  return JSON.stringify(payload)
}

async function decryptString(password: string, encryptedJson: string): Promise<string> {
  const dec = new TextDecoder()
  const parsed = JSON.parse(encryptedJson) as EncryptedPayload
  if (!parsed || parsed.v !== 1 || !parsed.salt || !parsed.iv || !parsed.ct) throw new Error("Invalid payload")
  const salt = fromBase64(parsed.salt)
  const iv = fromBase64(parsed.iv)
  const ct = fromBase64(parsed.ct)
  const key = await deriveAesKey(password, salt)
  const ptBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct)
  return dec.decode(ptBuf)
}

async function sha256Base64(text: string) {
  const enc = new TextEncoder()
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(text))
  return toBase64(new Uint8Array(hash))
}

async function apiGetBlob(signal?: AbortSignal): Promise<string | null> {
  const res = await fetch("/api/blob", { method: "GET", signal, headers: { Accept: "application/json" } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET /api/blob failed: ${res.status}`)
  const ct = res.headers.get("content-type") || ""
  if (ct.includes("application/json")) {
    const j = await res.json().catch(() => null)
    const blob = j?.blob ?? j?.data ?? j?.payload ?? j?.content ?? null
    if (typeof blob === "string") return blob
    return JSON.stringify(j)
  }
  return await res.text()
}

async function apiPostBlob(blob: string, signal?: AbortSignal) {
  const res = await fetch("/api/blob", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ blob }),
  })
  if (!res.ok) throw new Error(`POST /api/blob failed: ${res.status}`)
}

async function apiDeleteBlob(signal?: AbortSignal) {
  const res = await fetch("/api/blob", { method: "DELETE", signal, headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`DELETE /api/blob failed: ${res.status}`)
}

function readLocalBackupCandidate(): string | null {
  for (const k of LOCAL_BACKUP_KEYS_CANDIDATES) {
    const v = localStorage.getItem(k)
    if (typeof v === "string" && v.length > 0) return v
  }
  return null
}

export default function UserProfileButton() {
  const [language] = useLanguage()
  const t = translations[language]
  const { events = [], calendars = [] } = useCalendar()
  const { isLoaded, isSignedIn, user } = useUser()
  const router = useRouter()

  const [clerkUserId, setClerkUserId] = useState<string | null>(null)
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false)

  const [showAutoBackupDialog, setShowAutoBackupDialog] = useState(false)
  const [showSetPasswordDialog, setShowSetPasswordDialog] = useState(false)
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isAutoBackupEnabled, setIsAutoBackupEnabled] = useState(false)

  const encryptionKeyRef = useRef<string | null>(null)
  const lastUploadedHashRef = useRef<string | null>(null)
  const uploadTimerRef = useRef<number | null>(null)
  const inFlightRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (isLoaded && isSignedIn && user) setClerkUserId(user.id)
    else setClerkUserId(null)
  }, [isLoaded, isSignedIn, user])

  useEffect(() => {
    const enabled = localStorage.getItem(AUTO_BACKUP_ENABLED_KEY) === "true"
    setIsAutoBackupEnabled(enabled)
    if (enabled && !encryptionKeyRef.current) setShowUnlockDialog(true)
  }, [])

  useEffect(() => {
    const origSetItem = localStorage.setItem
    const origRemoveItem = localStorage.removeItem
    const origClear = localStorage.clear

    const dispatch = (key?: string | null, newValue?: string | null) => {
      window.dispatchEvent(new CustomEvent(LOCAL_BACKUP_CHANGED_EVENT, { detail: { key, newValue } }))
    }

    localStorage.setItem = function (key: string, value: string) {
      origSetItem.call(localStorage, key, value)
      dispatch(key, value)
    }
    localStorage.removeItem = function (key: string) {
      origRemoveItem.call(localStorage, key)
      dispatch(key, null)
    }
    localStorage.clear = function () {
      origClear.call(localStorage)
      dispatch(null, null)
    }

    return () => {
      localStorage.setItem = origSetItem
      localStorage.removeItem = origRemoveItem
      localStorage.clear = origClear
    }
  }, [])

  const isAutoBackupAllowed = useMemo(() => {
    if (!isSignedIn || !clerkUserId) return false
    const owner = localStorage.getItem(AUTO_BACKUP_USER_KEY)
    if (!owner) return true
    return owner === clerkUserId
  }, [isSignedIn, clerkUserId])

  const buildPlainBackup = () => {
    const localExisting = readLocalBackupCandidate()
    if (localExisting) return localExisting
    return JSON.stringify(
      {
        v: 1,
        ts: Date.now(),
        events,
        calendars,
      },
      null,
      0,
    )
  }

  const scheduleUpload = (reason: "storage" | "data" | "manual") => {
    if (!isAutoBackupEnabled) return
    if (!isAutoBackupAllowed) return
    if (!encryptionKeyRef.current) return
    if (uploadTimerRef.current) window.clearTimeout(uploadTimerRef.current)

    uploadTimerRef.current = window.setTimeout(async () => {
      uploadTimerRef.current = null
      try {
        const plaintext = buildPlainBackup()
        const h = await sha256Base64(plaintext)
        if (lastUploadedHashRef.current === h && reason !== "manual") return
        lastUploadedHashRef.current = h

        inFlightRef.current?.abort()
        const ac = new AbortController()
        inFlightRef.current = ac

        const encrypted = await encryptString(encryptionKeyRef.current!, plaintext)
        await apiPostBlob(encrypted, ac.signal)
        toast(language === "zh" ? "已上传云端备份" : "Cloud backup uploaded")
      } catch (e: any) {
        toast(language === "zh" ? `备份失败：${e?.message || "未知错误"}` : `Backup failed: ${e?.message || "Unknown error"}`)
      }
    }, 800)
  }

  useEffect(() => {
    if (!isAutoBackupEnabled) return
    if (!isAutoBackupAllowed) return
    if (!encryptionKeyRef.current) return
    scheduleUpload("data")
  }, [isAutoBackupEnabled, isAutoBackupAllowed, events, calendars])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return
      if (e.key === AUTO_BACKUP_ENABLED_KEY) {
        const enabled = localStorage.getItem(AUTO_BACKUP_ENABLED_KEY) === "true"
        setIsAutoBackupEnabled(enabled)
        if (enabled && !encryptionKeyRef.current) setShowUnlockDialog(true)
        if (!enabled) {
          encryptionKeyRef.current = null
          lastUploadedHashRef.current = null
        }
        return
      }
      if (isAutoBackupEnabled) scheduleUpload("storage")
    }

    const onPatched = (e: Event) => {
      const ce = e as CustomEvent<{ key?: string | null; newValue?: string | null }>
      const key = ce?.detail?.key ?? null
      if (key === AUTO_BACKUP_ENABLED_KEY) {
        const enabled = localStorage.getItem(AUTO_BACKUP_ENABLED_KEY) === "true"
        setIsAutoBackupEnabled(enabled)
        if (enabled && !encryptionKeyRef.current) setShowUnlockDialog(true)
        if (!enabled) {
          encryptionKeyRef.current = null
          lastUploadedHashRef.current = null
        }
        return
      }
      if (isAutoBackupEnabled) scheduleUpload("storage")
    }

    window.addEventListener("storage", onStorage)
    window.addEventListener(LOCAL_BACKUP_CHANGED_EVENT, onPatched as EventListener)

    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(LOCAL_BACKUP_CHANGED_EVENT, onPatched as EventListener)
    }
  }, [isAutoBackupEnabled, isAutoBackupAllowed])

  const enableAutoBackup = () => {
    setPasswordError("")
    if (!password || password !== confirmPassword) {
      setPasswordError(language === "zh" ? "密码不一致" : "Passwords do not match")
      return
    }
    if (!clerkUserId) {
      toast(language === "zh" ? "请先登录" : "Please sign in first")
      return
    }
    encryptionKeyRef.current = password
    localStorage.setItem(AUTO_BACKUP_ENABLED_KEY, "true")
    localStorage.setItem(AUTO_BACKUP_USER_KEY, clerkUserId)
    setIsAutoBackupEnabled(true)
    setShowSetPasswordDialog(false)
    setPassword("")
    setConfirmPassword("")
    toast(language === "zh" ? "自动备份已启用" : "Auto backup enabled")
    scheduleUpload("manual")
  }

  const unlockWithPassword = () => {
    setPasswordError("")
    if (!password) {
      setPasswordError(language === "zh" ? "请输入密码" : "Password required")
      return
    }
    encryptionKeyRef.current = password
    setShowUnlockDialog(false)
    setPassword("")
    toast(language === "zh" ? "已解锁加密备份" : "Backup unlocked")
    scheduleUpload("manual")
  }

  const disableAutoBackup = () => {
    encryptionKeyRef.current = null
    lastUploadedHashRef.current = null
    localStorage.removeItem(AUTO_BACKUP_ENABLED_KEY)
    localStorage.removeItem(AUTO_BACKUP_USER_KEY)
    setIsAutoBackupEnabled(false)
    toast(language === "zh" ? "自动备份已禁用" : "Auto backup disabled")
  }

  const handleLogin = () => router.push("/sign-in")
  const handleSignUp = () => router.push("/sign-up")

  const handleManualSyncUpload = async () => {
    if (!isSignedIn || !clerkUserId) {
      toast(language === "zh" ? "请先登录" : "Please sign in first")
      return
    }
    if (!isAutoBackupEnabled) {
      toast(language === "zh" ? "请先启用自动备份" : "Enable auto backup first")
      return
    }
    if (!encryptionKeyRef.current) {
      setShowUnlockDialog(true)
      return
    }
    scheduleUpload("manual")
  }

  const handleDeleteCloud = async () => {
    if (!isSignedIn || !clerkUserId) {
      toast(language === "zh" ? "请先登录" : "Please sign in first")
      return
    }
    try {
      inFlightRef.current?.abort()
      const ac = new AbortController()
      inFlightRef.current = ac
      await apiDeleteBlob(ac.signal)
      toast(language === "zh" ? "云端数据已删除" : "Cloud data deleted")
    } catch (e: any) {
      toast(language === "zh" ? `删除失败：${e?.message || "未知错误"}` : `Delete failed: ${e?.message || "Unknown error"}`)
    }
  }

  const handleFetchCloudRaw = async () => {
    if (!isSignedIn || !clerkUserId) {
      toast(language === "zh" ? "请先登录" : "Please sign in first")
      return
    }
    try {
      inFlightRef.current?.abort()
      const ac = new AbortController()
      inFlightRef.current = ac
      const raw = await apiGetBlob(ac.signal)
      if (!raw) {
        toast(language === "zh" ? "云端暂无备份" : "No cloud backup")
        return
      }
      toast(language === "zh" ? "已获取云端未解密数据" : "Fetched cloud encrypted blob")
    } catch (e: any) {
      toast(language === "zh" ? `获取失败：${e?.message || "未知错误"}` : `Fetch failed: ${e?.message || "Unknown error"}`)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {isSignedIn && user?.imageUrl ? (
            <Button variant="ghost" size="icon" className="rounded-full">
              <Image src={user.imageUrl} alt="avatar" width={32} height={32} className="rounded-full" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {isSignedIn ? (
            <>
              <DropdownMenuItem onClick={() => setIsUserProfileOpen(true)}>
                <CircleUser className="mr-2 h-4 w-4" />
                {language === "zh" ? "个人资料" : "Profile"}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setShowAutoBackupDialog(true)}>
                <CloudUpload className="mr-2 h-4 w-4" />
                {language === "zh" ? "自动备份" : "Auto Backup"}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleManualSyncUpload}>
                <FolderSync className="mr-2 h-4 w-4" />
                {language === "zh" ? "同步数据" : "Sync"}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleDeleteCloud}>
                <Trash2 className="mr-2 h-4 w-4" />
                {language === "zh" ? "删除数据" : "Delete"}
              </DropdownMenuItem>

              <SignOutButton>
                <DropdownMenuItem>
                  <LogOut className="mr-2 h-4 w-4" />
                  {language === "zh" ? "退出登录" : "Sign Out"}
                </DropdownMenuItem>
              </SignOutButton>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={handleLogin}>{language === "zh" ? "登录" : "Sign In"}</DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignUp}>{language === "zh" ? "注册" : "Sign Up"}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {isUserProfileOpen && (
        <Dialog open onOpenChange={setIsUserProfileOpen}>
          <DialogContent className="p-0 w-auto">
            <UserProfile />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showAutoBackupDialog} onOpenChange={setShowAutoBackupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "zh" ? "自动备份" : "Auto Backup"}</DialogTitle>
            <DialogDescription>
              {isAutoBackupEnabled
                ? language === "zh"
                  ? "已启用"
                  : "Enabled"
                : language === "zh"
                  ? "未启用"
                  : "Disabled"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" onClick={handleFetchCloudRaw}>
              {language === "zh" ? "获取云端 blob" : "GET blob"}
            </Button>
            <Button variant="secondary" onClick={handleManualSyncUpload}>
              {language === "zh" ? "上传本地备份" : "POST blob"}
            </Button>
            <Button variant="destructive" onClick={handleDeleteCloud}>
              {language === "zh" ? "删除云端数据" : "DELETE blob"}
            </Button>
          </div>

          <DialogFooter>
            {isAutoBackupEnabled ? (
              <Button variant="destructive" onClick={disableAutoBackup}>
                {language === "zh" ? "禁用" : "Disable"}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setShowAutoBackupDialog(false)
                  setShowSetPasswordDialog(true)
                }}
              >
                {language === "zh" ? "启用" : "Enable"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSetPasswordDialog} onOpenChange={setShowSetPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "zh" ? "设置加密密码" : "Set Encryption Password"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{language === "zh" ? "密码" : "Password"}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPasswordError("")
                  setPassword(e.target.value)
                }}
              />
            </div>
            <div>
              <Label>{language === "zh" ? "确认密码" : "Confirm Password"}</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setPasswordError("")
                  setConfirmPassword(e.target.value)
                }}
              />
            </div>
            {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
          </div>

          <DialogFooter>
            <Button onClick={enableAutoBackup}>{language === "zh" ? "确认" : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "zh" ? "解锁备份" : "Unlock Backup"}</DialogTitle>
          </DialogHeader>

          <Input
            type="password"
            value={password}
            onChange={(e) => {
              setPasswordError("")
              setPassword(e.target.value)
            }}
          />

          {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}

          <DialogFooter>
            <Button onClick={unlockWithPassword}>{language === "zh" ? "解锁" : "Unlock"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
