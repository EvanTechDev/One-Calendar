"use client"

import { useState } from "react"
import { User, Upload, Download, X, Check, Info, RefreshCw, Copy } from "lucide-react"
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
import { validatePassword, generateIdFromPassword } from "@/lib/backup-utils"
import { useCalendar } from "@/contexts/CalendarContext"
import { translations, useLanguage } from "@/lib/i18n"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function UserProfileButton() {
  const [language] = useLanguage()
  const t = translations[language]
  const { events = [], calendars = [], setEvents, setCalendars } = useCalendar()

  const [isBackupOpen, setIsBackupOpen] = useState(false)
  const [isRestoreOpen, setIsRestoreOpen] = useState(false)
  const [isDebugOpen, setIsDebugOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [directBackupId, setDirectBackupId] = useState("")
  const [allBackups, setAllBackups] = useState<any[]>([])
  const [isLoadingBackups, setIsLoadingBackups] = useState(false)
  const [lastBackupInfo, setLastBackupInfo] = useState<any>(null)

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

  // 加载所有备份
  const loadAllBackups = async () => {
    setIsLoadingBackups(true)
    try {
      // 直接从API获取所有备份
      const response = await fetch("/api/blob/list")
      if (!response.ok) {
        throw new Error(`Failed to list backups: ${response.status}`)
      }

      const result = await response.json()
      setAllBackups(result.backups || [])
      console.log("Loaded backups:", result.backups)
    } catch (error) {
      console.error("Error loading backups:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load backups",
      })
    } finally {
      setIsLoadingBackups(false)
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
    setDebugInfo(null)

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

      if (debugMode) {
        console.log(`Debug Mode - Backup ID: ${backupId}`)
        setDebugInfo({
          backupId,
          timestamp: new Date().toISOString(),
          dataSize: JSON.stringify(backupData).length,
          eventsCount: backupData.events.length,
          calendarsCount: backupData.calendars.length,
          contactsCount: contacts.length,
          notesCount: notes.length,
        })
      }

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

      // 保存最后一次备份的信息，包括实际文件名
      setLastBackupInfo(result)

      if (debugMode && result) {
        setDebugInfo((prev) => ({
          ...prev,
          apiResponse: result,
        }))
      }

      if (result.success) {
        console.log("Backup: Backup successful")
        toast({
          title: language === "zh" ? "备份成功" : "Backup Successful",
          description:
            language === "zh"
              ? "您的数据已成功备份。请保存您的密码，以便将来恢复数据。"
              : "Your data has been backed up successfully. Please save your password for future restoration.",
        })

        if (debugMode) {
          // 在调试模式下，显示备份ID和实际文件名
          toast({
            title: "Debug Info",
            description: `Backup ID: ${backupId}${result.actualFilename ? `\nActual filename: ${result.actualFilename}` : ""}`,
          })
        }

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

      if (debugMode) {
        setDebugInfo((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        }))
      }
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
    setDebugInfo(null)

    try {
      console.log("Restore: Starting restore process")

      // 从密码生成唯一ID
      const backupId = generateIdFromPassword(password)
      console.log(`Restore: Generated backup ID: ${backupId}`)

      if (debugMode) {
        console.log(`Debug Mode - Restore ID: ${backupId}`)
        setDebugInfo({
          backupId,
          timestamp: new Date().toISOString(),
          action: "restore",
        })
      }

      // 直接使用fetch调用API
      console.log("Restore: Fetching data from API")
      const response = await fetch(`/api/blob?id=${backupId}`, {
        method: "GET",
      })

      console.log(`Restore: API response status: ${response.status}`)

      if (debugMode) {
        setDebugInfo((prev) => ({
          ...prev,
          responseStatus: response.status,
          responseStatusText: response.statusText,
          responseHeaders: Object.fromEntries([...response.headers.entries()]),
        }))
      }

      if (!response.ok) {
        let errorMessage = ""
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || `API returned status ${response.status}`

          if (debugMode) {
            setDebugInfo((prev) => ({
              ...prev,
              errorData,
            }))
          }
        } catch (e) {
          errorMessage = `API returned status ${response.status}`
        }

        if (response.status === 404) {
          throw new Error(language === "zh" ? "未找到备份数据" : "No backup found for this password")
        }

        throw new Error(errorMessage)
      }

      const result = await response.json().catch(() => ({ success: false }))
      console.log("Restore: API response:", result)

      if (debugMode && result) {
        setDebugInfo((prev) => ({
          ...prev,
          apiResponse: {
            success: result.success,
            hasData: !!result.data,
            dataType: typeof result.data,
            dataLength:
              typeof result.data === "string"
                ? result.data.length
                : result.data
                  ? JSON.stringify(result.data).length
                  : 0,
          },
        }))
      }

      if (!result.success || !result.data) {
        throw new Error(language === "zh" ? "未找到备份数据" : "No backup data found")
      }

      // 解析数据
      let restoredData
      try {
        // 检查数据是否已经是对象
        if (typeof result.data === "object") {
          restoredData = result.data
        } else {
          restoredData = JSON.parse(result.data)
        }

        if (debugMode) {
          setDebugInfo((prev) => ({
            ...prev,
            parsedData: {
              hasEvents: !!restoredData.events,
              eventsCount: restoredData.events?.length || 0,
              hasCalendars: !!restoredData.calendars,
              calendarsCount: restoredData.calendars?.length || 0,
              hasContacts: !!restoredData.contacts,
              contactsCount: restoredData.contacts?.length || 0,
              hasNotes: !!restoredData.notes,
              notesCount: restoredData.notes?.length || 0,
              timestamp: restoredData.timestamp,
            },
          }))
        }
      } catch (parseError) {
        console.error("Restore: Error parsing data:", parseError)

        if (debugMode) {
          setDebugInfo((prev) => ({
            ...prev,
            parseError: parseError instanceof Error ? parseError.message : "Unknown parse error",
            parseErrorStack: parseError instanceof Error ? parseError.stack : undefined,
            rawData: typeof result.data === "string" ? result.data.substring(0, 200) + "..." : "Not a string",
          }))
        }

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

      if (debugMode) {
        setDebugInfo((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        }))
      }
    } finally {
      setIsLoading(false)
      setPassword("")
    }
  }

  // 直接通过URL恢复备份
  const handleRestoreFromUrl = async (url: string) => {
    setIsLoading(true)
    setDebugInfo(null)

    try {
      console.log(`Direct Restore: Starting restore process from URL: ${url}`)

      // 直接从URL获取数据
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch from URL: ${url}, status: ${response.status}`)
      }

      // 获取数据
      const text = await response.text()

      // 解析数据
      let data
      try {
        data = JSON.parse(text)
      } catch (parseError) {
        throw new Error(`Failed to parse data from URL: ${url}`)
      }

      // 恢复数据
      const { events: restoredEvents, calendars: restoredCalendars, contacts, notes } = data

      if (Array.isArray(restoredEvents)) {
        setEvents(restoredEvents)
      }

      if (Array.isArray(restoredCalendars)) {
        setCalendars(restoredCalendars)
      }

      saveLocalData({
        contacts: Array.isArray(contacts) ? contacts : [],
        notes: Array.isArray(notes) ? notes : [],
      })

      toast({
        title: "Restore Successful",
        description: `Successfully restored data from ${url}`,
      })
    } catch (error) {
      console.error("Direct URL Restore error:", error)
      toast({
        variant: "destructive",
        title: "Restore Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 直接通过ID恢复备份
  const handleDirectRestore = async () => {
    if (!directBackupId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a backup ID",
      })
      return
    }

    setIsLoading(true)
    setDebugInfo(null)

    try {
      console.log(`Direct Restore: Starting restore process for ID: ${directBackupId}`)

      // 尝试多种可能的URL
      const possibleUrls = [
        `/api/blob?id=${directBackupId}`,
        `https://public.blob.vercel-storage.com/backups/${directBackupId}.json`,
        `https://public.blob.vercel-storage.com/${directBackupId}.json`,
      ]

      let succeeded = false

      for (const url of possibleUrls) {
        try {
          console.log(`Direct Restore: Trying URL: ${url}`)

          const response = await fetch(url)
          console.log(`Direct Restore: Response status for ${url}: ${response.status}`)

          if (!response.ok) {
            console.log(`Direct Restore: Failed to fetch from ${url}, status: ${response.status}`)
            continue
          }

          let result
          if (url.startsWith("/api")) {
            // API路由返回的是JSON
            result = await response.json()
            if (!result.success || !result.data) {
              console.log(`Direct Restore: API returned success=false or no data`)
              continue
            }

            // 解析数据
            let restoredData
            try {
              if (typeof result.data === "object") {
                restoredData = result.data
              } else {
                restoredData = JSON.parse(result.data)
              }
            } catch (parseError) {
              console.error("Direct Restore: Error parsing API data:", parseError)
              continue
            }

            // 恢复数据
            const { events: restoredEvents, calendars: restoredCalendars, contacts, notes } = restoredData

            if (Array.isArray(restoredEvents)) setEvents(restoredEvents)
            if (Array.isArray(restoredCalendars)) setCalendars(restoredCalendars)

            saveLocalData({
              contacts: Array.isArray(contacts) ? contacts : [],
              notes: Array.isArray(notes) ? notes : [],
            })
          } else {
            // 直接URL返回的是JSON文本
            const text = await response.text()

            try {
              const data = JSON.parse(text)

              // 恢复数据
              const { events: restoredEvents, calendars: restoredCalendars, contacts, notes } = data

              if (Array.isArray(restoredEvents)) setEvents(restoredEvents)
              if (Array.isArray(restoredCalendars)) setCalendars(restoredCalendars)

              saveLocalData({
                contacts: Array.isArray(contacts) ? contacts : [],
                notes: Array.isArray(notes) ? notes : [],
              })
            } catch (parseError) {
              console.error("Direct Restore: Error parsing direct URL data:", parseError)
              continue
            }
          }

          // 如果到这里，说明成功了
          succeeded = true
          toast({
            title: "Restore Successful",
            description: `Successfully restored data from ${url}`,
          })
          break
        } catch (urlError) {
          console.error(`Direct Restore: Error with URL ${url}:`, urlError)
        }
      }

      if (!succeeded) {
        throw new Error(`Failed to restore from any URL for ID: ${directBackupId}`)
      }

      setIsDebugOpen(false)
    } catch (error) {
      console.error("Direct Restore error:", error)
      toast({
        variant: "destructive",
        title: "Direct Restore Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsLoading(false)
      setDirectBackupId("")
    }
  }

  // 复制文本到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          description: "Text has been copied to clipboard",
        })
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err)
      })
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
          {/* 调试模式切换 */}
          <DropdownMenuItem onClick={() => setDebugMode(!debugMode)}>
            {debugMode ? "✓ " : ""}
            {language === "zh" ? "调试模式" : "Debug Mode"}
          </DropdownMenuItem>
          {/* 调试信息对话框 - 仅在调试模式下显示 */}
          {debugMode && (
            <DropdownMenuItem
              onClick={() => {
                setIsDebugOpen(true)
                loadAllBackups()
              }}
            >
              <Info className="mr-2 h-4 w-4" />
              {language === "zh" ? "调试信息" : "Debug Info"}
            </DropdownMenuItem>
          )}
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

            {debugMode && (
              <div className="mt-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                <h4 className="text-sm font-medium mb-1">Debug Info</h4>
                <p className="text-xs">
                  Backup ID: {password ? generateIdFromPassword(password) : "Enter password to see ID"}
                </p>
                <div className="flex items-center mt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => password && copyToClipboard(generateIdFromPassword(password))}
                    disabled={!password}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy ID
                  </Button>
                </div>
              </div>
            )}
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

            {debugMode && (
              <div className="mt-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                <h4 className="text-sm font-medium mb-1">Debug Info</h4>
                <p className="text-xs">
                  Restore ID: {password ? generateIdFromPassword(password) : "Enter password to see ID"}
                </p>
                <div className="flex items-center mt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => password && copyToClipboard(generateIdFromPassword(password))}
                    disabled={!password}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy ID
                  </Button>
                </div>
              </div>
            )}
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

      {/* 调试信息对话框 */}
      <Dialog open={isDebugOpen} onOpenChange={setIsDebugOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Debug Information</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="direct">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="direct">Direct Restore</TabsTrigger>
              <TabsTrigger value="backups">Backup Browser</TabsTrigger>
              <TabsTrigger value="info">Debug Info</TabsTrigger>
            </TabsList>

            <TabsContent value="direct" className="space-y-4 mt-4">
              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">Direct Backup ID Access</h3>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter backup ID"
                    value={directBackupId}
                    onChange={(e) => setDirectBackupId(e.target.value)}
                  />
                  <Button onClick={handleDirectRestore} disabled={isLoading}>
                    {isLoading ? "Loading..." : "Restore"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This will attempt to directly restore a backup using the provided ID without password verification.
                </p>
              </div>

              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">Backup Path Information</h3>
                <p className="text-sm">The system stores backups in the following location:</p>
                <code className="bg-gray-100 p-2 rounded-md block mt-2 text-xs">backups/backup_[hash].json</code>
                <p className="text-sm mt-2">
                  Where [hash] is derived from your password. When restoring, the system will try multiple possible
                  paths:
                </p>
                <ul className="list-disc list-inside text-xs mt-2 space-y-1">
                  <li>https://public.blob.vercel-storage.com/backups/backup_[hash].json</li>
                  <li>https://public.blob.vercel-storage.com/backups/backup_[hash]_*.json (with additional hash)</li>
                  <li>https://public.blob.vercel-storage.com/backup_[hash].json</li>
                  <li>/api/blob?id=backup_[hash]</li>
                </ul>
              </div>

              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">Password to ID Converter</h3>
                <div className="space-y-2">
                  <Label htmlFor="password-converter">Password</Label>
                  <Input
                    id="password-converter"
                    type="text"
                    placeholder="Enter password to see ID"
                    onChange={(e) => {
                      if (e.target.value) {
                        setDebugInfo((prev) => ({
                          ...prev,
                          convertedId: generateIdFromPassword(e.target.value),
                        }))
                      }
                    }}
                  />
                  {debugInfo?.convertedId && (
                    <div className="bg-gray-100 p-2 rounded-md mt-2">
                      <p className="text-xs font-mono">ID: {debugInfo.convertedId}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs mt-1"
                        onClick={() => copyToClipboard(debugInfo.convertedId)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy ID
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {lastBackupInfo && (
                <div className="border rounded-md p-4">
                  <h3 className="font-medium mb-2">Last Backup Information</h3>
                  <pre className="bg-gray-100 p-2 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(lastBackupInfo, null, 2)}
                  </pre>
                </div>
              )}
            </TabsContent>

            <TabsContent value="backups" className="space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Available Backups</h3>
                <Button size="sm" onClick={loadAllBackups} disabled={isLoadingBackups}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingBackups ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {isLoadingBackups ? (
                <div className="text-center py-8">
                  <svg
                    className="animate-spin h-8 w-8 mx-auto text-primary"
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
                  <p className="mt-2 text-sm text-muted-foreground">Loading backups...</p>
                </div>
              ) : allBackups.length === 0 ? (
                <div className="text-center py-8 border rounded-md">
                  <p className="text-muted-foreground">No backups found</p>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <div className="grid grid-cols-3 gap-4 p-2 bg-muted font-medium text-sm">
                    <div>Pathname</div>
                    <div>Size</div>
                    <div>Actions</div>
                  </div>
                  <div className="divide-y">
                    {allBackups.map((backup, index) => (
                      <div key={index} className="grid grid-cols-3 gap-4 p-2 text-sm items-center">
                        <div className="truncate font-mono">{backup.pathname}</div>
                        <div>{(backup.size / 1024).toFixed(2)} KB</div>
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={() => handleRestoreFromUrl(backup.url)}>
                            Restore
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(backup.url)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="info" className="space-y-4 mt-4">
              {debugInfo ? (
                <div className="border rounded-md p-4">
                  <h3 className="font-medium mb-2">Debug Info</h3>
                  <pre className="bg-gray-100 p-4 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-8 border rounded-md">
                  <p className="text-muted-foreground">No debug information available</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Perform a backup or restore operation with debug mode enabled to see information here.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDebugOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

