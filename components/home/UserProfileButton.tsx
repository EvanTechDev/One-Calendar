import { useState, useEffect } from "react"
import { User, Upload, Download, X, Check, LogOut, CircleUser, FolderSync, CloudUpload } from 'lucide-react'
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
import { toast } from "sonner"
import { useCalendar } from "@/components/context/CalendarContext"
import { translations, useLanguage } from "@/lib/i18n"
import { Checkbox } from "@/components/ui/checkbox"
import { useUser, SignIn, SignUp, SignOutButton, UserProfile, useClerk } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Image from "next/image"

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

  const [replaceExistingData, setReplaceExistingData] = useState(true)
  const [showAutoBackupDialog, setShowAutoBackupDialog] = useState(false)
  const [isAutoBackupEnabled, setIsAutoBackupEnabled] = useState(false)
  const [currentBackupId, setCurrentBackupId] = useState<string | null>(null)

  const { isLoaded, isSignedIn, user } = useUser();
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false); 
  const [clerkUserId, setClerkUserId] = useState<string | null>(null);
  const router = useRouter()
  const [syncInterval, setSyncInterval] = useState<NodeJS.Timeout | null>(null);
  const [restoreInterval, setRestoreInterval] = useState<NodeJS.Timeout | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastRestoreTime, setLastRestoreTime] = useState<Date | null>(null);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const { openUserProfile } = useClerk();

  const handleLogin = () => {
    router.push("/sign-in")
  }

  const handleSignUp = () => {
    router.push("/sign-up")
  }

  const handleSignOut = () => {
    toast(language === "zh" ? "已登出" : "Signed Out", {
      description: language === "zh" ? "您已成功退出登录" : "You have been signed out",
    });
  };

  // 监听用户登录状态变化
useEffect(() => {
  if (isAutoBackupEnabled && clerkUserId) {
    const timer = setTimeout(() => {
      performAutoBackup();
    }, 1000); // 防抖1秒
    
    return () => clearTimeout(timer);
  }
}, [events, calendars, isAutoBackupEnabled, clerkUserId]);

// 监听用户登录状态变化
useEffect(() => {
  if (isLoaded) {
    if (isSignedIn && user) {
      setClerkUserId(user.id);
      const backupId = localStorage.getItem("auto-backup-id");
      if (backupId) {
        // setCurrentBackupId(backupId);
        console.log(backupId)
      }
    } else {
      setClerkUserId(null);
    }
  }
}, [isLoaded, isSignedIn, user]);

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
    toast(language === "zh" ? "保存本地数据失败" : "Failed to save local data", {
      variant: "destructive",
      description: error instanceof Error ? error.message : language === "zh" ? "未知错误" : "Unknown error",
    })
  }
}


// Add a function to enable auto-backup
const enableAutoBackup = () => {
  if (clerkUserId) {
    setIsAutoBackupEnabled(true);
    localStorage.setItem("auto-backup-enabled", "true"); // 明确设置为 "true"
    localStorage.setItem("auto-backup-id", clerkUserId);
    toast(anguage === "zh" ? "自动备份已启用" : "Auto-Backup Enabled", {
      description: language === "zh" 
        ? "您的数据将在每次更改时自动备份。" 
        : "Your data will be automatically backed up on changes.",
    });
    setShowAutoBackupDialog(false);
    performAutoBackup();
  }
};

const disableAutoBackup = () => {
  setIsAutoBackupEnabled(false);
  localStorage.removeItem("auto-backup-enabled");
  localStorage.removeItem("auto-backup-id");
  
  if (syncInterval) {
    clearInterval(syncInterval);
    setSyncInterval(null);
  }

  toast(language === "zh" ? "自动备份已禁用" : "Auto-Backup Disabled", {
    description: language === "zh" 
      ? "您的数据将不再自动备份" 
      : "Your data will no longer be automatically backed up"
  });
};

// Add a function to perform auto-backup
const performAutoBackup = async () => {
  if (!isAutoBackupEnabled || !clerkUserId) {
    console.log("Auto-backup skipped: disabled or no user ID");
    return;
  }

  try {
    console.log("Starting auto-backup...");
    const { contacts, notes, sharedEvents, bookmarks } = getLocalData();
    const backupData = {
      events: events || [],
      calendars: calendars || [],
      contacts,
      notes,
      sharedEvents,
      bookmarks,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch("/api/blob", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: `${clerkUserId}`,
        data: backupData,
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    console.log("Auto-backup successful!");
  } catch (error) {
    console.error("Auto-backup failed:", error);
  }
};

// Add useEffect to watch for data changes and trigger auto-backup
useEffect(() => {
  if (isAutoBackupEnabled && events.length > 0) {
    performAutoBackup()
  }
}, [events, calendars, isAutoBackupEnabled])

const restoreUserData = async (silent = true) => {
  if (!clerkUserId || isRestoring) return;
  
  setIsRestoring(true);
  try {
    const response = await fetch(`/api/blob?id=${clerkUserId}`);
    if (!response.ok) throw new Error("Backup not found");

    const result = await response.json();
    if (result.success && result.data) {
      const restoredData = typeof result.data === 'string' 
        ? JSON.parse(result.data) 
        : result.data;

      // 智能合并数据（保留您原有的合并逻辑）
      saveLocalData({
        contacts: restoredData.contacts || [],
        notes: restoredData.notes || [],
        sharedEvents: restoredData.sharedEvents || [],
        bookmarks: restoredData.bookmarks || []
      });

      if (Array.isArray(restoredData.events)) {
        setEvents(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const newEvents = restoredData.events.filter((e: any) => !existingIds.has(e.id));
          return [...prev, ...newEvents];
        });
      }

      setLastRestoreTime(new Date());
      
      if (!silent) {
        toast(language === "zh" ? "数据恢复成功" : "Data Restored", {
          description: language === "zh" 
            ? `已同步最新备份 (${new Date().toLocaleTimeString()})`
            : `Synced latest backup (${new Date().toLocaleTimeString()})`
        });
      }
    }
  } catch (error) {
    console.error("恢复失败:", error);
    if (!silent) {
      toast(language === "zh" ? "恢复失败" : "Restore Failed", {
        variant: "destructive",
        description: error instanceof Error 
          ? error.message 
          : language === "zh" ? "无法获取备份数据" : "Failed to fetch backup"
      });
    }
  } finally {
    setIsRestoring(false);
  }
};
// 修改后的用户登录状态 useEffect
useEffect(() => {
  if (!isLoaded || !isSignedIn || !user) return;

  setClerkUserId(user.id);
  
  restoreUserData(false); 
  
  const interval = setInterval(() => {
    restoreUserData(true);
  }, 30000);

  return () => clearInterval(interval);
}, [isLoaded, isSignedIn, user]);


useEffect(() => {
  return () => {
    if (syncInterval) {
      clearInterval(syncInterval);
    }
  };
}, [syncInterval]);

useEffect(() => {
  return () => {
    if (restoreInterval) {
      clearInterval(restoreInterval);
    }
  };
}, [restoreInterval]);

useEffect(() => {
  const isEnabled = localStorage.getItem("auto-backup-enabled") === "true";
  setIsAutoBackupEnabled(isEnabled);
}, []);

return (
    <>
      <DropdownMenu>
              <DropdownMenuTrigger asChild>
        {isSignedIn && user?.imageUrl ? (
          <Button variant="ghost" size="icon" className="rounded-full">
            <Image
              src={user.imageUrl}
              alt="User avatar"
              width={32}
              height={32}
              className="rounded-full"
              referrerPolicy="no-referrer"
            />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="rounded-full">
            <User className="h-5 w-5" />
            <span className="sr-only">{language === "zh" ? "用户资料" : "User Profile"}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
  
        <DropdownMenuContent align="end">
          {isSignedIn ? (
            <>
              <DropdownMenuItem 
                onClick={() => setIsUserProfileOpen(true)}
                className="cursor-pointer"
              >
                <CircleUser className="mr-2 h-4 w-4" />
                {language === "zh" ? "个人资料" : "Profile"}
              </DropdownMenuItem>
              <DropdownMenuItem 
                 onClick={() => setShowAutoBackupDialog(true)}
                 className="cursor-pointer"
              >
                <CloudUpload className="mr-2 h-4 w-4" />
                {language === "zh" ? "自动备份" : "Auto Backup"}
              </DropdownMenuItem>
              <DropdownMenuItem 
                 onClick={() => restoreUserData(false)}
                 className="cursor-pointer"
              >
                <FolderSync className="mr-2 h-4 w-4" />
                {language === "zh" ? "同步数据" : "Sync data"}
              </DropdownMenuItem>
              <SignOutButton signOutCallback={handleSignOut}>
                <DropdownMenuItem className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  {language === "zh" ? "退出登录" : "Sign Out"}
                </DropdownMenuItem>
              </SignOutButton>
            </>
          ) : (
            <>
              <DropdownMenuItem 
                onClick={handleLogin}
                className="cursor-pointer"
              >
                {language === "zh" ? "登录" : "Sign In"}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleSignUp}
                className="cursor-pointer"
              >
                {language === "zh" ? "注册" : "Sign Up"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

{isUserProfileOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="relative w-full max-w-4xl h-[90vh] bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
      <button
        onClick={() => setIsUserProfileOpen(false)}
        className="absolute top-4 right-4 z-10 p-2 rounded-full text-black"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="flex-1 overflow-auto p-4">
        <UserProfile />
      </div>
    </div>
  </div>
)}


      
      <Dialog open={showAutoBackupDialog} onOpenChange={setShowAutoBackupDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{language === "zh" ? "自动备份设置" : "Auto-Backup Settings"}</DialogTitle>
      <DialogDescription>
        {language === "zh" 
          ? `当前状态: ${isAutoBackupEnabled ? "已启用" : "已禁用"} (用户ID: ${clerkUserId})`
          : `Status: ${isAutoBackupEnabled ? "Enabled" : "Disabled"} (User ID: ${clerkUserId})`}
      </DialogDescription>
    </DialogHeader>
    <DialogFooter className="gap-2">
      {isAutoBackupEnabled && (
        <Button 
          variant="destructive" 
          onClick={() => {
            disableAutoBackup();
            setShowAutoBackupDialog(false);
          }}
        >
          {language === "zh" ? "禁用" : "Disable"}
        </Button>
      )}
      <Button 
        onClick={() => {
          enableAutoBackup();
          performAutoBackup();
        }}
      >
        {language === "zh" ? "启用" : "Enable"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
    </>
  )
}
