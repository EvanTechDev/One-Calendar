import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Copy, ExternalLink, Lock, Trash2 } from "lucide-react";
import { translations, useLanguage } from "@/lib/i18n"

interface SharedEvent {
  id: string;
  eventId: string;
  eventTitle: string;
  sharedBy: string;
  shareDate: string;
  shareLink: string;
  isProtected: boolean;
}

export default function ShareManagement() {
  const [language] = useLanguage();
  const t = translations[language];
  const [sharedEvents, setSharedEvents] = useState<SharedEvent[]>([]);
  const [selectedShare, setSelectedShare] = useState<SharedEvent | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingDecrypt, setLoadingDecrypt] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [decryptingShare, setDecryptingShare] = useState<SharedEvent | null>(null)
  const [isDecrypting, setIsDecrypting] = useState(false)


  useEffect(() => {
    async function fetchSharedEvents() {
      try {
        const res = await fetch("/api/share/list");
        if (!res.ok) throw new Error("Failed to fetch shared events");
        const data = await res.json();
        setSharedEvents(data.shares || []);
      } catch (error) {
        console.error("Error fetching shared events:", error);
        toast(language === "zh" ? "获取分享列表失败" : "Failed to load shared events", {
          variant: "destructive",
          description: error instanceof Error ? error.message : "",
        });
      }
    }
    fetchSharedEvents();
  }, [language]);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "yyyy-MM-dd HH:mm");
    } catch {
      return dateString;
    }
  };

  const copyShareLink = (shareLink: string) => {
    navigator.clipboard.writeText(shareLink);
    toast(language === "zh" ? "链接已复制" : "Link Copied");
  };

  const openShareLink = (shareLink: string) => {
    window.open(shareLink, "_blank");
  };

  const deleteShare = async () => {
    if (!selectedShare) return;
    try {
      setIsDeleting(true);
      const res = await fetch("/api/share", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedShare.id }),
      });
      if (!res.ok) throw new Error("Failed to delete share");
      setSharedEvents(sharedEvents.filter((s) => s.id !== selectedShare.id));
      toast(language === "zh" ? "分享已删除" : "Share Deleted");
    } catch (error) {
      toast(language === "zh" ? "删除失败" : "Delete Failed", { variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSelectedShare(null);
    }
  };

  const handleDecrypt = async () => {
  if (!decryptingShare || !passwordInput) return

  try {
    setIsDecrypting(true)

    const res = await fetch(
      `/api/share?id=${decryptingShare.id}&password=${encodeURIComponent(passwordInput)}`
    )
    const data = await res.json()

    if (!data.success) {
      toast(language === "zh" ? "密码错误" : "Invalid password", { variant: "destructive" })
      return
    }

    const parsed = JSON.parse(data.data)

    setSharedEvents((prev) =>
      prev.map((s) =>
        s.id === decryptingShare.id
          ? { ...s, eventId: parsed.id, eventTitle: parsed.title, isProtected: false }
          : s
      )
    )

    toast(language === "zh" ? "解密成功" : "Decrypted")
    setPasswordDialogOpen(false)
    setDecryptingShare(null)
    setPasswordInput("")
  } catch (error) {
    toast(language === "zh" ? "解密失败" : "Failed to decrypt", { variant: "destructive" })
  } finally {
    setIsDecrypting(false)
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
                    <h3 className="font-medium">
                      {share.isProtected ? (language === "zh" ? "受保护" : "Protected") : share.eventTitle}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {language === "zh" ? "分享日期：" : "Shared on: "} {formatDate(share.shareDate)}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="icon" onClick={() => copyShareLink(share.shareLink)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => openShareLink(share.shareLink)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {share.isProtected && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
  setDecryptingShare(share)
  setPasswordInput("")
  setPasswordDialogOpen(true)
}}
                        disabled={loadingDecrypt}
                      >
                        <Lock className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setSelectedShare(share);
                        setDeleteDialogOpen(true);
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
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
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

      <AlertDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>
        {language === "zh" ? "输入分享密码" : "Enter Share Password"}
      </AlertDialogTitle>
      <AlertDialogDescription>
        {language === "zh"
          ? "此分享受密码保护，请输入密码以查看内容。"
          : "This share is password protected. Enter the password to view it."}
      </AlertDialogDescription>
    </AlertDialogHeader>

    <div className="py-2">
      <Input
        type="password"
        value={passwordInput}
        onChange={(e) => setPasswordInput(e.target.value)}
        placeholder={language === "zh" ? "输入密码" : "Enter password"}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleDecrypt()
        }}
      />
    </div>

    <AlertDialogFooter>
      <AlertDialogCancel
        onClick={() => {
          setDecryptingShare(null)
          setPasswordInput("")
        }}
      >
        {language === "zh" ? "取消" : "Cancel"}
      </AlertDialogCancel>

      <AlertDialogAction onClick={handleDecrypt} disabled={isDecrypting}>
        {isDecrypting
          ? language === "zh"
            ? "解密中..."
            : "Decrypting..."
          : language === "zh"
          ? "解密"
          : "Decrypt"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

    </Card>
  );
}
