"use client";

import React, { useState, useRef, useEffect } from "react";
import { getEncryptionState, readEncryptedLocalStorage, subscribeEncryptionState, writeEncryptedLocalStorage } from "@/hooks/useLocalStorage";
import {
  Edit2,
  Trash2,
  X,
  MapPin,
  Users,
  Calendar,
  Bell,
  AlignLeft,
  ChevronDown,
  Bookmark,
  Download,
} from "lucide-react";
import { Share as Share2 } from "@/components/icons/share";
import { Button } from "@/components/ui/button";
import { zhCN, enUS } from "date-fns/locale";
import { format } from "date-fns";
import type { CalendarEvent } from "../calendar";
import type { Language } from "@/lib/i18n";
import { isZhLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCalendar } from "@/components/context/calendar-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import QRCode from "qrcode";
import { useUser } from "@clerk/nextjs";

interface EventPreviewProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  language: Language;
  timezone: string;
  openShareImmediately?: boolean;
}

export default function EventPreview({
  event,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onDuplicate,
  language,
  timezone,
  openShareImmediately,
}: EventPreviewProps) {
  const { calendars } = useCalendar();
  const isZh = isZhLanguage(language);
  const locale = isZh ? zhCN : enUS;
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [qrCodeDataURL, setQRCodeDataURL] = useState<string>("");
  const { isSignedIn, user } = useUser();
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [sharePassword, setSharePassword] = useState("");
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const colorMapping: Record<string, string> = {
  'bg-[#E6F6FD]': '#3B82F6',
  'bg-[#E7F8F2]': '#10B981',
  'bg-[#FEF5E6]': '#F59E0B',
  'bg-[#FFE4E6]': '#EF4444',
  'bg-[#F3EEFE]': '#8B5CF6',
  'bg-[#FCE7F3]': '#EC4899',
  'bg-[#EEF2FF]': '#6366F1',
  'bg-[#FFF0E5]': '#FB923C',
  'bg-[#E6FAF7]': '#14B8A6',
}

  
  useEffect(() => {
    if (open && openShareImmediately) {
      if (!isSignedIn) {
        toast(isZh ? "请先登录" : "Please sign in", {
          description:
            isZh
              ? "登录后才能使用分享功能"
              : "Sign in required to use share function",
          variant: "destructive",
        });
      } else {
        setShareDialogOpen(true);
      }
    }
  }, [open, openShareImmediately, isSignedIn, language]);

  useEffect(() => {
    let active = true;
    const loadBookmarks = () =>
      readEncryptedLocalStorage<any[]>("bookmarked-events", []).then((stored) => {
        if (active) {
          setBookmarks(stored);
        }
      });

    loadBookmarks();
    const unsubscribe = subscribeEncryptionState(() => {
      if (getEncryptionState().ready) {
        loadBookmarks();
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (event) {
      const isCurrentEventBookmarked = bookmarks.some((bookmark: any) => bookmark.id === event.id);
      setIsBookmarked(isCurrentEventBookmarked);
    }
  }, [event, bookmarks]);

  if (!event || !open) return null;

  const getCalendarName = () => {
    if (!event) return "";
    const calendar = calendars.find((cal) => cal.id === event.calendarId);
    return calendar ? calendar.name : "";
  };

  const formatDateRange = () => {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const dateFormat = "yyyy-MM-dd HH:mm";
    const startFormatted = format(startDate, dateFormat, { locale });
    const endFormatted = format(endDate, dateFormat, { locale });
    return `${startFormatted} – ${endFormatted}`;
  };

  const formatNotificationTime = () => {
    if (event.notification === 0) return isZh ? "事件开始时" : "At time of event";
    return isZh ? `${event.notification} 分钟前` : `${event.notification} minutes before`;
  };

  const getInitials = (name: string) => name.charAt(0).toUpperCase();

  const hasParticipants =
    event.participants &&
    event.participants.length > 0 &&
    event.participants.some((p) => p.trim() !== "");

  const toggleParticipants = () => setParticipantsOpen(!participantsOpen);

  const toggleBookmark = async () => {
    if (!event) return;
    if (isBookmarked) {
      const updatedBookmarks = bookmarks.filter((bookmark: any) => bookmark.id !== event.id);
      await writeEncryptedLocalStorage("bookmarked-events", updatedBookmarks);
      setBookmarks(updatedBookmarks);
      setIsBookmarked(false);
      toast(isZh ? "已取消收藏" : "Removed from bookmarks", {
        description: isZh ? "事件已从收藏夹中移除" : "Event has been removed from your bookmarks",
      });
    } else {
      const bookmarkData = {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        color: event.color,
        location: event.location,
        bookmarkedAt: new Date().toISOString(),
      };
      const updatedBookmarks = [...bookmarks, bookmarkData];
      await writeEncryptedLocalStorage("bookmarked-events", updatedBookmarks);
      setBookmarks(updatedBookmarks);
      setIsBookmarked(true);
      toast(isZh ? "已收藏" : "Bookmarked", {
        description: isZh ? "事件已添加到收藏夹" : "Event has been added to your bookmarks",
      });
    }
  };

  const handleShare = async () => {
    if (!event) return;
    if (!user) {
      toast(isZh ? "请先登录" : "Please sign in", {
        description: isZh ? "分享功能仅对登录用户开放" : "Share function available to signed-in users only",
        variant: "destructive",
      });
      return;
    }

    if (passwordEnabled) {
      const pwd = sharePassword.trim();
      if (pwd.length < 4) {
        toast(isZh ? "密码过短" : "Password too short", {
          description: isZh ? "密码至少 4 位" : "Password must be at least 4 characters",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (burnAfterRead) setBurnAfterRead(false);
    }

    try {
      setIsSharing(true);
      const shareId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      const clerkUsername = user.username || user.firstName || "Anonymous";
      const sharedEvent = { ...event, sharedBy: clerkUsername };

      const payload: any = { id: shareId, data: sharedEvent };
      if (passwordEnabled) payload.password = sharePassword;
      if (passwordEnabled) payload.burnAfterRead = !!burnAfterRead;

      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const msg = await response.json().catch(() => null);
        throw new Error(msg?.error || "Failed to share event");
      }

      const result = await response.json();

      if (result.success) {
        const link = `${window.location.origin}/share/${shareId}`;
        setShareLink(link);

        try {
          const qrURL = await QRCode.toDataURL(link, {
            width: 300,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
          });
          setQRCodeDataURL(qrURL);
        } catch {}

        const storedShares = await readEncryptedLocalStorage<any[]>("shared-events", []);
        storedShares.push({
          id: shareId,
          eventId: event.id,
          eventTitle: event.title,
          sharedBy: clerkUsername,
          shareDate: new Date().toISOString(),
          shareLink: link,
          protected: !!passwordEnabled,
          burnAfterRead: !!burnAfterRead,
        });
        await writeEncryptedLocalStorage("shared-events", storedShares);

        toast(isZh ? "分享成功" : "Shared", {
          description:
            passwordEnabled && burnAfterRead
              ? isZh
                ? "已启用密码保护 + 阅后即焚"
                : "Password protected + burn after read"
              : passwordEnabled
                ? isZh
                  ? "该分享已启用密码保护"
                  : "This share is password protected"
                : isZh
                  ? "分享链接已生成"
                  : "Share link generated",
        });
      } else {
        throw new Error("Failed to share event");
      }
    } catch (error) {
      toast(isZh ? "分享失败" : "Share Failed", {
        description: error instanceof Error ? error.message : isZh ? "未知错误" : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  const copyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast(isZh ? "链接已复制" : "Link Copied", {
        description: isZh ? "分享链接已复制到剪贴板" : "Share link copied to clipboard",
      });
    }
  };

  const downloadQRCode = () => {
    if (qrCodeDataURL) {
      const link = document.createElement("a");
      link.href = qrCodeDataURL;
      link.download = `${event?.title || "event"}-qrcode.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast(isZh ? "二维码已下载" : "QR Code Downloaded", {
        description: isZh ? "已保存到您的设备" : "Saved to your device",
      });
    }
  };

  const handleShareDialogChange = (open: boolean) => {
    if (!open) {
      setShareLink("");
      setQRCodeDataURL("");
      setPasswordEnabled(false);
      setSharePassword("");
      setBurnAfterRead(false);
    }
    setShareDialogOpen(open);
  };

  const handleDialogClick = (e: React.MouseEvent) => e.stopPropagation();

  const cleanupSharesForEvent = async () => {
    const storedShares = await readEncryptedLocalStorage<any[]>("shared-events", []);
    const relatedShares = storedShares.filter((s: any) => s?.eventId === event.id);
    if (!relatedShares.length) return;

    const results = await Promise.allSettled(
      relatedShares.map((s: any) =>
        fetch("/api/share", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: s.id }),
        })
      )
    );

    await writeEncryptedLocalStorage(
      "shared-events",
      storedShares.filter((s: any) => s?.eventId !== event.id),
    );

    const failed = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !(r.value as Response).ok)
    );

    if (failed.length) {
      toast(isZh ? "删除分享失败" : "Failed to delete shares", {
        description:
          isZh
            ? "部分分享记录未能从服务器删除，但已从本地移除"
            : "Some shares could not be deleted from server, but were removed locally",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await cleanupSharesForEvent();
    } catch {
      toast(isZh ? "删除分享失败" : "Failed to delete shares", {
        description:
          isZh
            ? "分享清理发生错误，但将继续删除事件"
            : "Share cleanup encountered an error, but event deletion will continue",
        variant: "destructive",
      });
    } finally {
      onDelete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => onOpenChange(false)}>
      <div
        className="bg-background rounded-xl shadow-lg w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5">
          <div className="w-24"></div>
          <div className="flex space-x-2 ml-auto">
            <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
              <Edit2 className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                if (!isSignedIn) {
                  toast(isZh ? "请先登录" : "Please sign in", {
                    description: isZh ? "登录后才能使用分享功能" : "Sign in required to use share function",
                    variant: "destructive",
                  });
                  return;
                }
                handleShareDialogChange(true);
              }}
              className="h-8 w-8"
            >
              <Share2 className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleBookmark} className="h-8 w-8">
              <Bookmark className={cn("h-5 w-5", isBookmarked ? "fill-blue-500 text-blue-500" : "")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDeleteClick} className="h-8 w-8">
              <Trash2 className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 ml-2">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="px-5 pb-5 flex">
          <div
  className="w-2 self-stretch rounded-full mr-4"
  style={{ backgroundColor: colorMapping[event.color] }}
/>

          <div className="flex-1">
            <h2
              className="mb-1 text-2xl font-bold break-words break-all overflow-hidden [overflow-wrap:anywhere]"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {event.title}
            </h2>
            <p className="text-muted-foreground">{formatDateRange()}</p>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {event.location && event.location.trim() !== "" && (
            <div className="flex items-start">
              <MapPin className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p>{event.location}</p>
              </div>
            </div>
          )}

          {hasParticipants && (
            <div className="flex items-start">
              <Users className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center justify-between cursor-pointer" onClick={toggleParticipants}>
                  <p>
                    {event.participants.filter((p) => p.trim() !== "").length}{" "}
                    {isZh ? "参与者" : "participants"}
                  </p>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", participantsOpen ? "transform rotate-180" : "")} />
                </div>
                {participantsOpen && (
                  <div className="mt-2 space-y-2">
                    {event.participants
                      .filter((p) => p.trim() !== "")
                      .map((participant, index) => (
                        <div key={index} className="flex items-center">
                          <div className="bg-gray-200 rounded-full h-8 w-8 flex items-center justify-center mr-2">
                            <span className="font-medium">{getInitials(participant)}</span>
                          </div>
                          <p>{participant}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {getCalendarName() && (
            <div className="flex items-start">
              <Calendar className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p>{getCalendarName()}</p>
              </div>
            </div>
          )}

          {event.notification > 0 && (
            <div className="flex items-start">
              <Bell className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p>{formatNotificationTime()}</p>
                <p className="text-sm text-muted-foreground">
                  {isZh ? `${event.notification} 分钟前 按电子邮件` : `${event.notification} minutes before by email`}
                </p>
              </div>
            </div>
          )}

          {event.description && event.description.trim() !== "" && (
            <div className="flex items-start">
              <AlignLeft className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p
                  className="whitespace-pre-wrap break-words break-all overflow-hidden [overflow-wrap:anywhere]"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {event.description}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={shareDialogOpen} onOpenChange={handleShareDialogChange}>
        <DialogContent className="sm:max-w-md" ref={dialogContentRef} onClick={handleDialogClick}>
          <DialogHeader>
            <DialogTitle>{isZh ? "分享事件" : "Share Event"}</DialogTitle>
          </DialogHeader>

          {!shareLink ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="shared-by">{isZh ? "分享" : "Share"}</Label>
                <p className="text-sm text-muted-foreground">
                  {isZh ? "您将以当前登录身份进行事件分享。" : "You will share this event as your current logged-in identity."}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enable-password">{isZh ? "启用密码保护" : "Enable password protection"}</Label>
                  <input
                    id="enable-password"
                    type="checkbox"
                    checked={passwordEnabled}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setPasswordEnabled(v);
                      if (!v) {
                        setSharePassword("");
                        setBurnAfterRead(false);
                      }
                    }}
                    className="h-4 w-4"
                  />
                </div>

                {passwordEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="share-password">{isZh ? "分享密码" : "Share password"}</Label>
                    <Input
                      id="share-password"
                      type="password"
                      value={sharePassword}
                      onChange={(e) => setSharePassword(e.target.value)}
                      placeholder={isZh ? "至少 4 位" : "At least 4 characters"}
                    />
                    <p className="text-xs text-muted-foreground">
                      {isZh
                        ? "服务器不会保存密码，访问者需要输入正确密码才能查看。"
                        : "The server does not store the password. Viewers must enter it to see the event."}
                    </p>

                    <div className="flex items-center justify-between pt-2">
                      <Label htmlFor="burn-after-read">{isZh ? "阅后即焚" : "Burn after read"}</Label>
                      <input
                        id="burn-after-read"
                        type="checkbox"
                        checked={burnAfterRead}
                        onChange={(e) => setBurnAfterRead(e.target.checked)}
                        className="h-4 w-4"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isZh
                        ? "访问者输入正确密码并成功解密后，该分享会自动从服务器删除。"
                        : "After a viewer decrypts successfully, this share is automatically deleted from the server."}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShareDialogChange(false);
                  }}
                >
                  {isZh ? "取消" : "Cancel"}
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare();
                  }}
                  disabled={isSharing}
                >
                  {isSharing ? (
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
                      {isZh ? "分享中..." : "Sharing..."}
                    </span>
                  ) : (
                    <>{isZh ? "分享" : "Share"}</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="share-link">{isZh ? "分享链接" : "Share Link"}</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="share-link"
                      value={shareLink}
                      readOnly
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyShareLink();
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyShareLink();
                      }}
                    >
                      {isZh ? "复制" : "Copy"}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isZh
                      ? "任何拥有此链接的人都可以访问分享页面。若启用密码保护，需要输入密码才能查看内容。"
                      : "Anyone with this link can access the share page. If password protected, they must enter the password to view the content."}
                  </p>
                </div>

                {qrCodeDataURL && (
                  <div className="mt-4 flex flex-col items-center">
                    <Label className="mb-2">{isZh ? "二维码" : "QR Code"}</Label>
                    <div className="border p-3 rounded bg-white mb-2">
                      <img src={qrCodeDataURL || "/placeholder.svg"} alt="QR Code" className="w-full max-w-[200px] mx-auto" />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadQRCode();
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {isZh ? "下载二维码" : "Download QR Code"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      {isZh ? "扫描此二维码可立即查看日程" : "Scan this QR code to view the event"}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShareDialogChange(false);
                  }}
                >
                  {isZh ? "完成" : "Done"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
