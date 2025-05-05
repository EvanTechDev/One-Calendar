"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Trash2, Copy, ExternalLink } from "lucide-react"
import { format } from "date-fns"
import { translations, useLanguage } from "@/lib/i18n"
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

interface SharedEvent {
  id: string
  eventId: string
  eventTitle: string
  sharedBy: string
  shareDate: string
  shareLink: string
}

export default function ShareManagement() {
  const [language] = useLanguage()
  const t = translations[language]
  const [sharedEvents, setSharedEvents] = useState<SharedEvent[]>([])
  const [selectedShare, setSelectedShare] = useState<SharedEvent | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load shared events from localStorage
  useEffect(() => {
    const storedShares = localStorage.getItem("shared-events")
    if (storedShares) {
      try {
        setSharedEvents(JSON.parse(storedShares))
      } catch (error) {
        console.error("Error parsing shared events:", error)
      }
    }
  }, [])

  // Copy share link to clipboard
  const copyShareLink = (shareLink: string) => {
    navigator.clipboard.writeText(shareLink)
    toast(language === "zh" ? "链接已复制" : "Link Copied", {
      description: language === "zh" ? "分享链接已复制到剪贴板" : "Share link copied to clipboard",
    })
  }

  // Open share link in new tab
  const openShareLink = (shareLink: string) => {
    window.open(shareLink, "_blank")
  }

  // Delete a shared event
  const deleteShare = async () => {
    if (!selectedShare) return

    try {
      setIsDeleting(true)

      // Call API to delete the share
      const response = await fetch("/api/share", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedShare.id,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to delete share")
      }

      // Update localStorage
      const updatedShares = sharedEvents.filter((share) => share.id !== selectedShare.id)
      localStorage.setItem("shared-events", JSON.stringify(updatedShares))
      setSharedEvents(updatedShares)

      toast(language === "zh" ? "分享已删除" : "Share Deleted", {
        description: language === "zh" ? "分享已成功删除" : "Share has been successfully deleted",
      })
    } catch (error) {
      console.error("Error deleting share:", error)
      toast(language === "zh" ? "删除失败" : "Delete Failed", {
        description: error instanceof Error ? error.message : language === "zh" ? "未知错误" : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setSelectedShare(null)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "yyyy-MM-dd HH:mm")
    } catch (error) {
      return dateString
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{language === "zh" ? "管理分享" : "Manage Shares"}</CardTitle>
            <CardDescription>
              {language === "zh" ? "管理您分享的日历事件" : "Manage your shared calendar events"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {sharedEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {language === "zh" ? "暂无分享的事件" : "No shared events"}
          </div>
        ) : (
          <div className="space-y-4">
            {sharedEvents.map((share) => (
              <div key={share.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{share.eventTitle}</h3>
                    <p className="text-sm text-muted-foreground">
                      {language === "zh" ? "分享者：" : "Shared by: "}
                      {share.sharedBy}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === "zh" ? "分享日期：" : "Shared on: "}
                      {formatDate(share.shareDate)}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="icon" onClick={() => copyShareLink(share.shareLink)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => openShareLink(share.shareLink)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setSelectedShare(share)
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "zh" ? "删除分享" : "Delete Share"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "zh"
                ? "确定要删除此分享吗？此操作无法撤销，分享链接将不再可用。"
                : "Are you sure you want to delete this share? This action cannot be undone and the share link will no longer be accessible."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "zh" ? "取消" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteShare} disabled={isDeleting}>
              {isDeleting ? (
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
                  {language === "zh" ? "删除中..." : "Deleting..."}
                </span>
              ) : (
                <>{language === "zh" ? "删除" : "Delete"}</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

