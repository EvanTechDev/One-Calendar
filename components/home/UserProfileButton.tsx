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
import { es } from "@/lib/encryptedStorage"
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
    if (!es.isUnlocked) return
    if (!restoredRef.current) return

    const handleStorageChange = async () => {
      if (timerRef.current) clearTimeout(timerRef.current)

      timerRef.current = setTimeout(async () => {
        const eventsData = await es.getItem("calendar-events")
        const calendarsData = await es.getItem("calendar-categories")

        if (!eventsData || !calendarsData) return

        const combinedData = JSON.stringify({
          events: JSON.parse(eventsData),
          calendars: JSON.parse(calendarsData)
        })

        const iv = crypto.getRandomValues(new Uint8Array(12))
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const encoder = new TextEncoder()
        
        const keyMaterial = await crypto.subtle.importKey(
          "raw",
          encoder.encode(keyRef.current),
          "PBKDF2",
          false,
          ["deriveKey"]
        )
        
        const key = await crypto.subtle.deriveKey(
          { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt"]
        )
        
        const ciphertext = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          encoder.encode(combinedData)
        )
        
        const encrypted = JSON.stringify({
          v: 1,
          salt: btoa(String.fromCharCode(...salt)),
          iv: btoa(String.fromCharCode(...iv)),
          ct: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
        })

        await apiPost({
          ciphertext: encrypted,
          iv: btoa(String.fromCharCode(...iv))
        })

        timerRef.current = null
      }, 800)
    }

    window.addEventListener("storage", handleStorageChange)
    handleStorageChange()

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled])

  async function unlock() {
    if (!password) return

    const cloud = await apiGet()
    if (!cloud) return

    const unlockSuccess = await es.unlock(password)
    if (!unlockSuccess) {
      toast(language === "zh" ? "解锁失败" : "Unlock failed")
      return
    }

    let plainData
    try {
      plainData = await es.decryptValue(cloud.ciphertext)
      if (!plainData) throw new Error("Decryption failed")
    } catch {
      toast(language === "zh" ? "密码错误" : "Incorrect password")
      es.lock()
      return
    }

    try {
      const data = JSON.parse(plainData)
      if (data?.events && data?.calendars) {
        await es.setItem("calendar-events", JSON.stringify(data.events))
        await es.setItem("calendar-categories", JSON.stringify(data.calendars))
        setEvents(data.events)
        setCalendars(data.calendars)
      }
    } catch {
      toast(language === "zh" ? "数据格式错误" : "Data format error")
      es.lock()
      return
    }

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

    const unlockSuccess = await es.unlock(password)
    if (!unlockSuccess) {
      toast(language === "zh" ? "解锁失败" : "Unlock failed")
      return
    }

    await es.setItem("calendar-events", JSON.stringify(events))
    await es.setItem("calendar-categories", JSON.stringify(calendars))

    const combinedData = JSON.stringify({ events, calendars })
    
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const encoder = new TextEncoder()
    
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    )
    
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    )
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(combinedData)
    )
    
    const encrypted = JSON.stringify({
      v: 1,
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv)),
      ct: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
    })

    await apiPost({
      ciphertext: encrypted,
      iv: btoa(String.fromCharCode(...iv))
    })

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

    if (!keyRef.current || keyRef.current !== oldPassword) {
      toast(language === "zh" ? "旧密码错误" : "Incorrect old password")
      return
    }

    await es.unlock(oldPassword)
    const eventsData = await es.getItem("calendar-events")
    const calendarsData = await es.getItem("calendar-categories")

    if (!eventsData || !calendarsData) {
      toast(language === "zh" ? "读取数据失败" : "Failed to read data")
      return
    }

    es.lock()
    await es.unlock(password)

    await es.setItem("calendar-events", eventsData)
    await es.setItem("calendar-categories", calendarsData)

    const combinedData = JSON.stringify({
      events: JSON.parse(eventsData),
      calendars: JSON.parse(calendarsData)
    })
    
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const encoder = new TextEncoder()
    
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    )
    
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    )
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(combinedData)
    )
    
    const encrypted = JSON.stringify({
      v: 1,
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv)),
      ct: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
    })

    await apiPost({
      ciphertext: encrypted,
      iv: btoa(String.fromCharCode(...iv))
    })

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
    es.lock()
    toast(language === "zh" ? "自动备份已关闭" : "Auto backup disabled")
  }

  async function destroy() {
    await apiDelete()
    localStorage.removeItem(AUTO_KEY)
    localStorage.removeItem("calendar-events")
    localStorage.removeItem("calendar-categories")
    keyRef.current = null
    restoredRef.current = false
    setEnabled(false)
    es.lock()
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
            <DialogDescription>
              {language === "zh" ? "请设置加密密码并记住和妥善保管您的加密密码，不要向任何人透露它" : "Please set an encryption password and remember and keep your encryption password safe. Do not reveal it to anyone"}
            </DialogDescription>
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
        {language === "zh" ? "输入密码" : "Enter the password"}
      </DialogTitle>
      <DialogDescription>
        {language === "zh"
          ? "输入密码以解锁和备份数据"
          : "Enter the password to unlock and backup data"}
      </DialogDescription>
    </DialogHeader>

    <Input
      type="password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
    />

    <DialogFooter>
      <Button onClick={unlock}>
        {language === "zh" ? "确认" : "Confirm"}
      </Button>
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
