"use client"

import { useState } from "react"
import { User, Upload, Download, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { validatePassword } from "@/lib/backup-utils"
import { useCalendar } from "@/contexts/CalendarContext"
import { translations, useLanguage } from "@/lib/i18n"

export default function UserProfileButton() {
  const [language] = useLanguage()
  const t = translations[language]
  const { events = [], calendars = [], setEvents, setCalendars } = useCalendar()

  const [isBackupOpen, setIsBackupOpen] = useState(false)
  const [isRestoreOpen, setIsRestoreOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // 从密码生成唯一ID
  function generateIdFromPassword(password: string): string {
    // 简单的哈希函数，用于从密码生成唯一ID
    let hash = 0
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // 转换为32位整数
    }
    return `backup_${Math.abs(hash).toString(16)}`
  }

  // 从localStorage获取联系人和笔记数据
  const getLocalData = () => {
    try {
      console.log("Getting data from localStorage")
      const contactsStr = localStorage.getItem("contacts")
      const notesStr = localStorage.getItem("notes")

      const contacts = contactsStr ? JSON.parse(contactsStr) : []
      const notes = notesStr ? JSON.parse(notesStr) : []

      console.log(`Found ${contacts.length} contacts and ${notes.length} notes`)
      return { contacts, notes }
    } catch (error) {
      console.error("Error getting data from localStorage:", error)
      return { contacts: [], notes: [] }
    }
  }

  // 将数据保存到localStorage
  const saveLocalData = (data: { contacts?: any[]; notes?: any[] }) => {
    try {
      const contacts = data.contacts || []
      const notes = data.notes || []

      console.log(`Saving ${contacts.length} contacts and ${notes.length} notes to localStorage`)
      localStorage.setItem("contacts", JSON.stringify(contacts))
      localStorage.setItem("notes", JSON.stringify(notes))
      console.log("Data saved to localStorage")
    } catch (error) {
      console.error("Error saving data to localStorage:", error)
      toast({
        variant: "destructive",
        title: language === "zh" ? "保存本地数据失败" : "Failed to save local data",
        description: error instanceof Error ? error.message : language === "zh" ? "未知错误" : "Unknown error",
      })
    }
  }

  // 处理备份
  const handleBackup = async () => {
    // 验证密码
    if (!validatePassword(password)) {
      setPasswordError(
        language === "zh"
          ? "密码必须至少包含8个字符，包括大小写字母、数字和特殊字符"
          : "Password must be at least 8 characters and include uppercase, lowercase, numbers, and special characters",
      )
      return
    }

    // 确认密码
    if (password !== confirmPassword) {
      setPasswordError(language === "zh" ? "两次输入的密码不匹配" : "Passwords do not match")
      return
    }

    setIsLoading(true)
    setPasswordError("")

    try {
      console.log("Backup: Starting backup process")

      // 获取所有数据
      const { contacts, notes } = getLocalData()

      // 准备备份数据
      const backupData = {
        events: events || [],
        calendars: calendars || [],
        contacts,
        notes,
        timestamp: new Date().toISOString(),
      }

      console.log(
        `Backup: Prepared data with ${backupData.events.length} events, ${backupData.calendars.length} calendars`,
      )

      // 从密码生成唯一ID
      const backupId = generateIdFromPassword(password)
      console.log(`Backup: Generated backup ID: ${backupId}`)

      // 直接使用fetch调用API
      console.log("Backup: Sending data to API")
      const response = await fetch("/api/blob", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: backupId,
          data: backupData,
        }),
      })

      console.log(`Backup: API response status: ${response.status}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API returned status ${response.status}`)
      }

      const result = await response.json().catch(() => ({ success: false }))
      console.log("Backup: API response:", result)

      if (result.success) {
        console.log("Backup: Backup successful")
        toast({
          title: language === "zh" ? "备份成功" : "Backup Successful",
          description:
            language === "zh"
              ? "您的数据已成功备份。请保存您的密码，以便将来恢复数据。"
              : "Your data has been backed up successfully. Please save your password for future restoration.",
        })
        setIsBackupOpen(false)
      } else {
        throw new Error(result.error || (language === "zh" ? "备份失败" : "Backup failed"))
      }
    } catch (error) {
      console.error("Backup error:", error)
      toast({
        variant: "destructive",
        title: language === "zh" ? "备份失败" : "Backup Failed",
        description: error instanceof Error ? error.message : language === "zh" ? "未知错误" : "Unknown error",
      })
    } finally {
      setIsLoading(false)
      setPassword("")
      setConfirmPassword("")
    }
  }

  // 处理恢复
  const handleRestore = async () => {
    if (!password) {
      setPasswordError(language === "zh" ? "请输入密码" : "Please enter a password")
      return
    }

    setIsLoading(true)
    setPasswordError("")

    try {
      console.log("Restore: Starting restore process")

      // 从密码生成唯一ID
      const backupId = generateIdFromPassword(password)
      console.log(`Restore: Generated backup ID: ${backupId}`)

      // 直接使用fetch调用API
      console.log("Restore: Fetching data from API")
      const response = await fetch(`/api/blob?id=${backupId}`, {
        method: "GET",
      })

      console.log(`Restore: API response status: ${response.status}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(language === "zh" ? "未找到备份数据" : "No backup found for this password")
        }

        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API returned status ${response.status}`)
      }

      const result = await response.json().catch(() => ({ success: false }))
      console.log("Restore: API response:", result)

      if (!result.success || !result.data) {
        throw new Error(language === "zh" ? "未找到备份数据" : "No backup data found")
      }

      // 解析数据
      let restoredData
      try {
        restoredData = JSON.parse(result.data)
      } catch (parseError) {
        console.error("Restore: Error parsing data:", parseError)
        throw new Error(language === "zh" ? "数据格式错误" : "Invalid data format")
      }

      console.log("Restore: Successfully parsed data")

      // 恢复数据到应用
      const { events: restoredEvents, calendars: restoredCalendars, contacts, notes } = restoredData

      // 更新日历事件和分类
      if (Array.isArray(restoredEvents)) {
        console.log(`Restore: Restoring ${restoredEvents.length} events`)
        setEvents(restoredEvents)
      } else {
        console.warn("Restore: No valid events data found")
      }

      if (Array.isArray(restoredCalendars)) {
        console.log(`Restore: Restoring ${restoredCalendars.length} calendars`)
        setCalendars(restoredCalendars)
      } else {
        console.warn("Restore: No valid calendars data found")
      }

      // 更新localStorage中的联系人和笔记
      console.log("Restore: Restoring contacts and notes to localStorage")
      saveLocalData({
        contacts: Array.isArray(contacts) ? contacts : [],
        notes: Array.isArray(notes) ? notes : [],
      })

      console.log("Restore: All data restored successfully")
      toast({
        title: language === "zh" ? "恢复成功" : "Restore Successful",
        description: language === "zh" ? "您的数据已成功恢复。" : "Your data has been restored successfully.",
      })
      setIsRestoreOpen(false)
    } catch (error) {
      console.error("Restore error:", error)
      toast({
        variant: "destructive",
        title: language === "zh" ? "恢复失败" : "Restore Failed",
        description: error instanceof Error ? error.message : language === "zh" ? "未知错误" : "Unknown error",
      })
    } finally {
      setIsLoading(false)
      setPassword("")
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <User className="h-5 w-5" />
            <span className="sr-only">{language === "zh" ? "用户资料" : "User Profile"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsBackupOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            {language === "zh" ? "备份数据" : "Backup Data"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsRestoreOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            {language === "zh" ? "导入数据" : "Restore Data"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 备份对话框 */}
      <Dialog open={isBackupOpen} onOpenChange={setIsBackupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "zh" ? "备份数据" : "Backup Data"}</DialogTitle>
            <DialogDescription>
              {language === "zh"
                ? "请创建一个强密码来保护您的数据。您将需要此密码来恢复数据。"
                : "Please create a strong password to protect your data. You will need this password to restore your data."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="password">{language === "zh" ? "密码" : "Password"}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={language === "zh" ? "输入密码" : "Enter password"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{language === "zh" ? "确认密码" : "Confirm Password"}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={language === "zh" ? "确认密码" : "Confirm password"}
              />
            </div>
            {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
            <p className="text-sm text-muted-foreground">
              {language === "zh"
                ? "密码必须至少包含8个字符，包括大小写字母、数字和特殊字符。"
                : "Password must be at least 8 characters and include uppercase, lowercase, numbers, and special characters."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBackupOpen(false)} disabled={isLoading}>
              <X className="mr-2 h-4 w-4" />
              {language === "zh" ? "取消" : "Cancel"}
            </Button>
            <Button onClick={handleBackup} disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {language === "zh" ? "处理中..." : "Processing..."}
                </span>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {language === "zh" ? "备份" : "Backup"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 恢复对话框 */}
      <Dialog open={isRestoreOpen} onOpenChange={setIsRestoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "zh" ? "导入数据" : "Restore Data"}</DialogTitle>
            <DialogDescription>
              {language === "zh"
                ? "请输入您之前用于备份数据的密码。"
                : "Please enter the password you used to backup your data."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="restorePassword">{language === "zh" ? "密码" : "Password"}</Label>
              <Input
                id="restorePassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={language === "zh" ? "输入备份密码" : "Enter backup password"}
              />
            </div>
            {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
            <p className="text-sm text-muted-foreground">
              {language === "zh"
                ? "警告：恢复数据将覆盖您当前的所有数据。此操作无法撤销。"
                : "Warning: Restoring data will overwrite all your current data. This action cannot be undone."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRestoreOpen(false)} disabled={isLoading}>
              <X className="mr-2 h-4 w-4" />
              {language === "zh" ? "取消" : "Cancel"}
            </Button>
            <Button onClick={handleRestore} disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {language === "zh" ? "处理中..." : "Processing..."}
                </span>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {language === "zh" ? "导入" : "Restore"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

