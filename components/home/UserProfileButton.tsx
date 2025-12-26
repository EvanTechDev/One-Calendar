
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
import { useLanguage } from "@/lib/i18n"
import { useUser, SignOutButton, UserProfile } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Image from "next/image"

const AUTO_KEY = "auto-backup-enabled"

function b64(u: Uint8Array) {
  return btoa(String.fromCharCode(...u))
}

function ub64(s: string) {
  return new Uint8Array(atob(s).split("").map((c) => c.charCodeAt(0)))
}

async function derive(password: string, salt: Uint8Array) {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    k,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

async function encrypt(password: string, text: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await derive(password, salt)
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text),
  )
  return {
    ciphertext: JSON.stringify({ v: 1, salt: b64(salt), ct: b64(new Uint8Array(ct)) }),
    iv: b64(iv),
  }
}

async function decrypt(password: string, ciphertext: string, iv: string) {
  const d = JSON.parse(ciphertext)
  const key = await derive(password, ub64(d.salt))
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ub64(iv) },
    key,
    ub64(d.ct),
  )
  return new TextDecoder().decode(pt)
}

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

export default function UserProfileButton() {
  const [language] = useLanguage()
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
      const payload = await encrypt(
        keyRef.current!,
        JSON.stringify({ events, calendars }),
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
      plain = await decrypt(password, cloud.ciphertext, cloud.iv)
    } catch {
      toast(language === "zh" ? "密码错误" : "Incorrect password")
      return
    }

    try {
      const data = JSON.parse(plain)
      if (data?.events && data?.calendars) {
        setEvents(data.events)
        setCalendars(data.calendars)
      }
    } catch {}

    keyRef.current = password
    restoredRef.current = true
    localStorage.setItem(AUTO_KEY, "true")
    setEnabled(true)

    setPassword("")
    setUnlockOpen(false)

    toast(language === "zh" ? "数据已恢复并开启自动备份" : "Data restored and auto backup enabled")
  }

  async function enable() {
    if (password !== confirm) {
      setError(language === "zh" ? "密码不一致" : "Passwords do not match")
      return
    }
    const payload = await encrypt(
      password,
      JSON.stringify({ events, calendars }),
    )
    await apiPost(payload)
    localStorage.setItem(AUTO_KEY, "true")
    keyRef.current = password
    restoredRef.current = true
    setEnabled(true)
    setPassword("")
    setConfirm("")
    setSetPwdOpen(false)
    toast(language === "zh" ? "自动备份已启用" : "Auto backup enabled")
  }

  async function rotate() {
    if (password !== confirm) {
      setError(language === "zh" ? "密码不一致" : "Passwords do not match")
      return
    }
    const cloud = await apiGet()
    if (!cloud) return

    let plain
    try {
      plain = await decrypt(oldPassword, cloud.ciphertext, cloud.iv)
    } catch {
      toast(language === "zh" ? "旧密码错误" : "Incorrect old password")
      return
    }

    const next = await encrypt(password, plain)
    await apiPost(next)
    keyRef.current = password
    setRotateOpen(false)
    setOldPassword("")
    setPassword("")
    setConfirm("")
    toast(language === "zh" ? "加密密钥已更新" : "Encryption key updated")
  }

  function disableAutoBackup() {
    localStorage.removeItem(AUTO_KEY)
    keyRef.current = null
    restoredRef.current = false
    setEnabled(false)
    toast(language === "zh" ? "自动备份已关闭" : "Auto backup disabled")
  }

  async function destroy() {
    await apiDelete()
    localStorage.removeItem(AUTO_KEY)
    keyRef.current = null
    restoredRef.current = false
    setEnabled(false)
    toast(language === "zh" ? "云端数据已删除" : "Cloud data deleted")
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
                {language === "zh" ? "个人资料" : "Profile"}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setBackupOpen(true)}>
                <CloudUpload className="mr-2 h-4 w-4" />
                {language === "zh" ? "自动备份" : "Auto Backup"}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setRotateOpen(true)}>
                <KeyRound className="mr-2 h-4 w-4" />
                {language === "zh" ? "更改密钥" : "Change Key"}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={destroy}>
                <Trash2 className="mr-2 h-4 w-4" />
                {language === "zh" ? "删除数据" : "Delete Data"}
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
              <DropdownMenuItem onClick={() => router.push("/sign-in")}>
                {language === "zh" ? "登录" : "Sign In"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/sign-up")}>
                {language === "zh" ? "注册" : "Sign Up"}
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
            <DialogTitle>{language === "zh" ? "自动备份" : "Auto Backup"}</DialogTitle>
            <DialogDescription>
              {enabled
                ? language === "zh"
                  ? "已启用"
                  : "Enabled"
                : language === "zh"
                  ? "未启用"
                  : "Disabled"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {enabled ? (
              <Button variant="destructive" onClick={disableAutoBackup}>
                {language === "zh" ? "关闭" : "Disable"}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setBackupOpen(false)
                  setSetPwdOpen(true)
                }}
              >
                {language === "zh" ? "启用" : "Enable"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={setPwdOpen} onOpenChange={setSetPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "zh" ? "设置加密密码" : "Set Encryption Password"}</DialogTitle>
          </DialogHeader>
          <Label>{language === "zh" ? "密码" : "Password"}</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Label>{language === "zh" ? "确认密码" : "Confirm Password"}</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button onClick={enable}>{language === "zh" ? "确认" : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "zh" ? "解锁备份" : "Unlock Backup"}</DialogTitle>
          </DialogHeader>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <DialogFooter>
            <Button onClick={unlock}>{language === "zh" ? "解锁" : "Unlock"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "zh" ? "更改加密密钥" : "Change Encryption Key"}</DialogTitle>
          </DialogHeader>
          <Label>{language === "zh" ? "旧密码" : "Old Password"}</Label>
          <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
          <Label>{language === "zh" ? "新密码" : "New Password"}</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Label>{language === "zh" ? "确认新密码" : "Confirm New Password"}</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button onClick={rotate}>{language === "zh" ? "确认更改" : "Confirm Change"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
