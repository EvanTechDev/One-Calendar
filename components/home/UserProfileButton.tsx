"use client"

import { useState, useEffect, useRef } from "react"
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
import { useUser, SignOutButton, UserProfile } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Image from "next/image"

let memoryEncryptionKey: string | null = null

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

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      setClerkUserId(user.id)
    } else {
      setClerkUserId(null)
    }
  }, [isLoaded, isSignedIn, user])

  useEffect(() => {
    const enabled = localStorage.getItem("auto-backup-enabled") === "true"
    setIsAutoBackupEnabled(enabled)
    if (enabled && !memoryEncryptionKey) {
      setShowUnlockDialog(true)
    }
  }, [])

  const enableAutoBackup = () => {
    if (!password || password !== confirmPassword) {
      setPasswordError(language === "zh" ? "密码不一致" : "Passwords do not match")
      return
    }
    memoryEncryptionKey = password
    localStorage.setItem("auto-backup-enabled", "true")
    localStorage.setItem("auto-backup-user", clerkUserId || "")
    setIsAutoBackupEnabled(true)
    setShowSetPasswordDialog(false)
    setPassword("")
    setConfirmPassword("")
    toast(language === "zh" ? "自动备份已启用" : "Auto backup enabled")
  }

  const unlockWithPassword = () => {
    if (!password) {
      setPasswordError(language === "zh" ? "请输入密码" : "Password required")
      return
    }
    memoryEncryptionKey = password
    setShowUnlockDialog(false)
    setPassword("")
    toast(language === "zh" ? "已解锁加密备份" : "Backup unlocked")
  }

  const disableAutoBackup = () => {
    memoryEncryptionKey = null
    localStorage.removeItem("auto-backup-enabled")
    localStorage.removeItem("auto-backup-user")
    setIsAutoBackupEnabled(false)
    toast(language === "zh" ? "自动备份已禁用" : "Auto backup disabled")
  }

  const handleLogin = () => router.push("/sign-in")
  const handleSignUp = () => router.push("/sign-up")

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

              <DropdownMenuItem>
                <FolderSync className="mr-2 h-4 w-4" />
                {language === "zh" ? "同步数据" : "Sync"}
              </DropdownMenuItem>

              <DropdownMenuItem>
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
              <DropdownMenuItem onClick={handleLogin}>
                {language === "zh" ? "登录" : "Sign In"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignUp}>
                {language === "zh" ? "注册" : "Sign Up"}
              </DropdownMenuItem>
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
                ? language === "zh" ? "已启用" : "Enabled"
                : language === "zh" ? "未启用" : "Disabled"}
            </DialogDescription>
          </DialogHeader>
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
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div>
              <Label>{language === "zh" ? "确认密码" : "Confirm Password"}</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
            {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
          </div>
          <DialogFooter>
            <Button onClick={enableAutoBackup}>
              {language === "zh" ? "确认" : "Confirm"}
            </Button>
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
            onChange={e => setPassword(e.target.value)}
          />
          {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
          <DialogFooter>
            <Button onClick={unlockWithPassword}>
              {language === "zh" ? "解锁" : "Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
