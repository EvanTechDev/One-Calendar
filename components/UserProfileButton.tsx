import { useState, useEffect } from "react"
import { User, Upload, Download, X, Check, LogOut } from 'lucide-react'
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
import { Checkbox } from "@/components/ui/checkbox"

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

  // First, add new state variables for the replace data checkbox and auto-backup dialog
  const [replaceExistingData, setReplaceExistingData] = useState(true)
  const [showAutoBackupDialog, setShowAutoBackupDialog] = useState(false)
  const [isAutoBackupEnabled, setIsAutoBackupEnabled] = useState(false)
  const [currentBackupId, setCurrentBackupId] = useState<string | null>(null)

  // Add useEffect to load auto-backup state from localStorage
  useEffect(() => {
    const storedAutoBackup = localStorage.getItem("auto-backup-enabled")
    const storedBackupId = localStorage.getItem("auto-backup-id")

    if (storedAutoBackup === "true" && storedBackupId) {
      setIsAutoBackupEnabled(true)
      setCurrentBackupId(storedBackupId)
    }
  }, [])

  // 从localStorage获取联系人和笔记数据
  const getLocalData = () => {
    try {
      console.log("Getting data from localStorage")
      const contactsStr = localStorage.getItem("contacts")
      const notesStr = localStorage.getItem("notes")
      const sharedEventsStr = localStorage.getItem("shared-events")
      const bookmarksStr = localStorage.getItem("bookmarked-events") // Add this line

      const contacts = contactsStr ? JSON.parse(contactsStr) : []
      const notes = notesStr ? JSON.parse(notesStr) : []
      const sharedEvents = sharedEventsStr ? JSON.parse(sharedEventsStr) : []
      const bookmarks = bookmarksStr ? JSON.parse(bookmarksStr) : [] // Add this line

      console.log(`Found ${contacts.length} contacts, ${notes.length} notes, ${sharedEvents.length} shared events, and ${bookmarks.length} bookmarks`,
)
return { contacts, notes, sharedEvents, bookmarks } // Include bookmarks in the returned data
} catch (error)
{
  console.error("Error getting data from localStorage:", error)
  return { contacts: [], notes: [], sharedEvents: [], bookmarks: [] } // Include empty bookmarks array
}
}

// 将数据保存到localStorage
const saveLocalData = (data: { contacts?: any[]; notes?: any[]; sharedEvents?: any[]; bookmarks?: any[] }) => {
  try {
    const contacts = data.contacts || []
    const notes = data.notes || []
    const sharedEvents = data.sharedEvents || []
    const bookmarks = data.bookmarks || [] // Add this line

    console.log(
      `Saving ${contacts.length} contacts, ${notes.length} notes, ${sharedEvents.length} shared events, and ${bookmarks.length} bookmarks to localStorage`,
    )
    localStorage.setItem("contacts", JSON.stringify(contacts))
    localStorage.setItem("notes", JSON.stringify(notes))
    localStorage.setItem("shared-events", JSON.stringify(sharedEvents))
    localStorage.setItem("bookmarked-events", JSON.stringify(bookmarks)) // Add this line
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
    const { contacts, notes, sharedEvents, bookmarks } = getLocalData() // 获取包含分享事件的数据

    // 准备备份数据
    const backupData = {
      events: events || [],
      calendars: calendars || [],
      contacts,
      notes,
      sharedEvents,
      bookmarks, // Add this line
      timestamp: new Date().toISOString(),
    }

    console.log(
      `Backup: Prepared data with ${backupData.events.length} events, ${backupData.calendars.length} calendars, ${backupData.sharedEvents.length} shared events, and ${backupData.bookmarks.length} bookmarks`,
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

      // 显示自动备份对话框
      setCurrentBackupId(backupId)
      setShowAutoBackupDialog(true)
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

// Modify the handleRestore function to check the replaceExistingData checkbox
const handleRestore = async () => {
  if (!password) {
    setPasswordError(language === "zh" ? "请输入密码" : "Please enter a password")
    return
  }

  setIsLoading(true)
  setPasswordError("")

  try {
    console.log("Restore: Starting restore process")

    // From password generate unique ID
    const backupId = generateIdFromPassword(password)
    console.log(`Restore: Generated backup ID: ${backupId}`)

    // Directly use fetch to call API
    console.log("Restore: Fetching data from API")
    const response = await fetch(`/api/blob?id=${backupId}`, {
      method: "GET",
    })

    console.log(`Restore: API response status: ${response.status}`)

    if (!response.ok) {
      let errorMessage = ""
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || `API returned status ${response.status}`
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

    if (!result.success || !result.data) {
      throw new Error(language === "zh" ? "未找到备份数据" : "No backup data found")
    }

    // Parse data
    let restoredData
    try {
      // Check if data is already an object
      if (typeof result.data === "object") {
        restoredData = result.data
      } else {
        restoredData = JSON.parse(result.data)
      }
    } catch (parseError) {
      console.error("Restore: Error parsing data:", parseError)
      throw new Error(language === "zh" ? "数据格式错误" : "Invalid data format")
    }

    console.log("Restore: Successfully parsed data")

    // Restore data to application
    const {
      events: restoredEvents,
      calendars: restoredCalendars,
      contacts,
      notes,
      sharedEvents,
      bookmarks,
    } = restoredData

    // Update calendar events and categories based on replaceExistingData checkbox
    if (Array.isArray(restoredEvents)) {
      console.log(`Restore: Restoring ${restoredEvents.length} events`)
      if (replaceExistingData) {
        setEvents(restoredEvents)
      } else {
        // Merge with existing events, avoiding duplicates by ID
        const existingIds = events.map((event) => event.id)
        const newEvents = restoredEvents.filter((event) => !existingIds.includes(event.id))
        setEvents([...events, ...newEvents])
      }
    } else {
      console.warn("Restore: No valid events data found")
    }

    if (Array.isArray(restoredCalendars)) {
      console.log(`Restore: Restoring ${restoredCalendars.length} calendars`)
      if (replaceExistingData) {
        setCalendars(restoredCalendars)
      } else {
        // Merge with existing calendars, avoiding duplicates by ID
        const existingIds = calendars.map((cal) => cal.id)
        const newCalendars = restoredCalendars.filter((cal) => !existingIds.includes(cal.id))
        setCalendars([...calendars, ...newCalendars])
      }
    } else {
      console.warn("Restore: No valid calendars data found")
    }

    // Update contacts, notes, and shared events in localStorage based on replaceExistingData checkbox
    console.log("Restore: Restoring contacts, notes, and shared events to localStorage")
    if (replaceExistingData) {
      saveLocalData({
        contacts: Array.isArray(contacts) ? contacts : [],
        notes: Array.isArray(notes) ? notes : [],
        sharedEvents: Array.isArray(sharedEvents) ? sharedEvents : [],
        bookmarks: Array.isArray(restoredData.bookmarks) ? restoredData.bookmarks : [], // Add this line
      })
    } else {
      // Merge with existing data
      const existingData = getLocalData()

      // Merge contacts, avoiding duplicates by ID
      const existingContactIds = existingData.contacts.map((contact) => contact.id)
      const newContacts = Array.isArray(contacts)
        ? contacts.filter((contact) => !existingContactIds.includes(contact.id))
        : []

      // Merge notes, avoiding duplicates by ID
      const existingNoteIds = existingData.notes.map((note) => note.id)
      const newNotes = Array.isArray(notes) ? notes.filter((note) => !existingNoteIds.includes(note.id)) : []

      // Merge shared events, avoiding duplicates by ID
      const existingSharedEventIds = existingData.sharedEvents.map((event) => event.id)
      const newSharedEvents = Array.isArray(sharedEvents)
        ? sharedEvents.filter((event) => !existingSharedEventIds.includes(event.id))
        : []

      // Merge bookmarks, avoiding duplicates by ID
      const existingBookmarkIds = existingData.bookmarks.map((bookmark) => bookmark.id)
      const newBookmarks = Array.isArray(restoredData.bookmarks)
        ? restoredData.bookmarks.filter((bookmark) => !existingBookmarkIds.includes(bookmark.id))
        : []

      saveLocalData({
        contacts: [...existingData.contacts, ...newContacts],
        notes: [...existingData.notes, ...newNotes],
        sharedEvents: [...existingData.sharedEvents, ...newSharedEvents],
        bookmarks: [...existingData.bookmarks, ...newBookmarks], // Add this line
      })
    }

    console.log("Restore: All data restored successfully")
    toast({
      title: language === "zh" ? "恢复成功" : "Restore Successful",
      description: language === "zh" ? "您的数据已成功恢复。" : "Your data has been restored successfully.",
    })

    setIsRestoreOpen(false)

    // 删除以下两行
    // setShowAutoBackupDialog(true)
    // setCurrentBackupId(backupId)
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

// Add a function to enable auto-backup
const enableAutoBackup = () => {
  if (currentBackupId) {
    setIsAutoBackupEnabled(true)
    localStorage.setItem("auto-backup-enabled", "true")
    localStorage.setItem("auto-backup-id", currentBackupId)

    toast({
      title: language === "zh" ? "自动备份已启用" : "Auto-Backup Enabled",
      description:
        language === "zh"
          ? "您的数据将在每次更改时自动备份。"
          : "Your data will be automatically backed up whenever changes are made.",
    })

    setShowAutoBackupDialog(false)
  }
}

// Add a function to disable auto-backup (logout)
const disableAutoBackup = () => {
  setIsAutoBackupEnabled(false)
  localStorage.removeItem("auto-backup-enabled")
  localStorage.removeItem("auto-backup-id")
  setCurrentBackupId(null)

  toast({
    title: language === "zh" ? "自动备份已禁用" : "Auto-Backup Disabled",
    description:
      language === "zh" ? "您的数据将不再自动备份。" : "Your data will no longer be automatically backed up.",
  })
}

// Add a function to perform auto-backup
const performAutoBackup = async () => {
  if (!isAutoBackupEnabled || !currentBackupId) return

  try {
    console.log("Auto-Backup: Starting backup process")

    // Get all data
    const { contacts, notes, sharedEvents, bookmarks } = getLocalData() // 获取包含分享事件的数据

    // Prepare backup data
    const backupData = {
      events: events || [],
      calendars: calendars || [],
      contacts,
      notes,
      sharedEvents,
      bookmarks, // Add this line
      timestamp: new Date().toISOString(),
    }

    console.log(
      `Auto-Backup: Prepared data with ${backupData.events.length} events, ${backupData.calendars.length} calendars, ${backupData.sharedEvents.length} shared events, and ${backupData.bookmarks.length} bookmarks`,
    )

    // Directly use fetch to call API
    console.log("Auto-Backup: Sending data to API")
    const response = await fetch("/api/blob", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: currentBackupId,
        data: backupData,
      }),
    })

    if (!response.ok) {
      console.error(`Auto-Backup: API returned status ${response.status}`)
      return
    }

    console.log("Auto-Backup: Backup successful")
  } catch (error) {
    console.error("Auto-Backup error:", error)
  }
}

// Add useEffect to watch for data changes and trigger auto-backup
useEffect(() => {
  if (isAutoBackupEnabled && events.length > 0) {
    performAutoBackup()
  }
}, [events, calendars, isAutoBackupEnabled])

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
          {isAutoBackupEnabled && (
            <DropdownMenuItem onClick={disableAutoBackup}>
              <LogOut className="mr-2 h-4 w-4" />
              {language === "zh" ? "退出登录" : "Logout"}
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
                ? "请创建一个强密码来保护您的数据。您将需要此密码来恢复数据。使用相同密码进行备份将覆盖之前的备份。"
                : "Please create a strong password to protect your data. You will need this password to restore your data. Using the same password will overwrite previous backups."}
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
            <div className="flex items-center space-x-2 mt-4">
              <Checkbox
                id="replace-data"
                checked={replaceExistingData}
                onCheckedChange={(checked) => setReplaceExistingData(checked as boolean)}
              />
              <Label htmlFor="replace-data">{language === "zh" ? "替换现有数据？" : "Replace existing data?"}</Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              {replaceExistingData
                ? language === "zh"
                  ? "这将删除您当前的所有数据，并替换为备份数据。"
                  : "This will delete all your current data and replace it with the backup data."
                : language === "zh"
                  ? "这将保留您当前的数据，并添加备份中的新数据。"
                  : "This will keep your current data and add new data from the backup."}
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
      <Dialog open={showAutoBackupDialog} onOpenChange={setShowAutoBackupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "zh" ? "启用自动备份？" : "Enable Auto-Backup?"}</DialogTitle>
            <DialogDescription>
              {language === "zh"
                ? "是否希望在每次更改数据时，自动使用此密码备份您的数据？"
                : "Would you like to automatically backup your data with this password whenever changes are made?"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              {language === "zh"
                ? "启用后，您的数据将在每次更改时自动备份到云端，您可以随时使用相同的密码恢复数据。"
                : "When enabled, your data will be automatically backed up to the cloud whenever changes are made. You can restore your data at any time using the same password."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoBackupDialog(false)}>
              {language === "zh" ? "取消" : "Cancel"}
            </Button>
            <Button onClick={enableAutoBackup}>{language === "zh" ? "启用自动备份" : "Enable Auto-Backup"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
