"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Share2,
  Bookmark,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { zhCN, enUS } from "date-fns/locale";
import { format } from "date-fns";
import type { CalendarEvent } from "../Calendar";
import type { Language } from "@/lib/i18n";
import { translations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCalendar } from "@/components/context/CalendarContext";
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
  const t = translations[language];
  const locale = language === "zh" ? zhCN : enUS;
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  // 移除原来的昵称状态
  // const [nickname, setNickname] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [qrCodeDataURL, setQRCodeDataURL] = useState<string>("");

  const { isSignedIn, user } = useUser(); // 获取当前用户信息

  // 添加一个 ref 来防止事件冒泡
  const dialogContentRef = useRef<HTMLDivElement>(null);

  const [bookmarks, setBookmarks] = useState<any[]>([]);

  useEffect(() => {
    if (open && openShareImmediately) {
      // 若用户未登录则提示先登录，不打开分享对话框
      if (!isSignedIn) {
        toast(language === "zh" ? "请先登录" : "Please sign in", {
          description: language === "zh" ? "登录后才能使用分享功能" : "Sign in required to use share function",
          variant: "destructive",
        });
      } else {
        setShareDialogOpen(true);
      }
    }
  }, [open, openShareImmediately, isSignedIn, language]);

  useEffect(() => {
    // Get bookmarks from localStorage
    const storedBookmarks = JSON.parse(localStorage.getItem("bookmarked-events") || "[]");
    setBookmarks(storedBookmarks);
  }, []);

  useEffect(() => {
    if (event) {
      // Check if current event is bookmarked
      const isCurrentEventBookmarked = bookmarks.some(
        (bookmark: any) => bookmark.id === event.id
      );
      setIsBookmarked(isCurrentEventBookmarked);
    }
  }, [event, bookmarks]);

  // 如果 event 为 null 或对话框未打开，则不渲染
  if (!event || !open) {
    return null;
  }

  // 获取日历名称
  const getCalendarName = () => {
    if (!event) return "";
    const calendar = calendars.find((cal) => cal.id === event.calendarId);
    return calendar ? calendar.name : "";
  };

  // 格式化日期范围（移除了星期显示）
  const formatDateRange = () => {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const dateFormat = "yyyy-MM-dd HH:mm";
    const startFormatted = format(startDate, dateFormat, { locale });
    const endFormatted = format(endDate, dateFormat, { locale });
    return `${startFormatted} – ${endFormatted}`;
  };

  // 格式化通知时间
  const formatNotificationTime = () => {
    if (event.notification === 0) {
      return language === "zh" ? "事件开始时" : "At time of event";
    }
    return language === "zh" ? `${event.notification} 分钟前` : `${event.notification} minutes before`;
  };

  // 获取参与者头像初始字母
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // 检查是否有有效参与者
  const hasParticipants =
    event.participants &&
    event.participants.length > 0 &&
    event.participants.some((p) => p.trim() !== "");

  // 切换参与者展示
  const toggleParticipants = () => {
    setParticipantsOpen(!participantsOpen);
  };

  const toggleBookmark = () => {
    if (!event) return;

    if (isBookmarked) {
      const updatedBookmarks = bookmarks.filter((bookmark: any) => bookmark.id !== event.id);
      localStorage.setItem("bookmarked-events", JSON.stringify(updatedBookmarks));
      setBookmarks(updatedBookmarks);
      setIsBookmarked(false);
      toast(language === "zh" ? "已取消收藏" : "Removed from bookmarks", {
        description:
          language === "zh"
            ? "事件已从收藏夹中移除"
            : "Event has been removed from your bookmarks",
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
      localStorage.setItem("bookmarked-events", JSON.stringify(updatedBookmarks));
      setBookmarks(updatedBookmarks);
      setIsBookmarked(true);
      toast(language === "zh" ? "已收藏" : "Bookmarked", {
        description:
          language === "zh"
            ? "事件已添加到收藏夹"
            : "Event has been added to your bookmarks",
      });
    }
  };

  // 修改后的分享函数：使用 Clerk 自动获取的用户名
  const handleShare = async () => {
    if (!event) return;
    if (!user) {
      // 未登录则不允许分享
      toast(language === "zh" ? "请先登录" : "Please sign in", {
        description: language === "zh" ? "分享功能仅对登录用户开放" : "Share function available to signed-in users only",
        variant: "destructive",
      });
      return;
    }
    try {
      setIsSharing(true);

      // 生成唯一 shareId
      const shareId = Date.now().toString() + Math.random().toString(36).substring(2, 9);

      // 使用 Clerk 获取的用户名
      const clerkUsername = user.username || user.firstName || "Anonymous";

      // 构造共享事件数据，直接用 clerkUsername 作为共享者名称
      const sharedEvent = {
        ...event,
        sharedBy: clerkUsername,
      };

      const response = await fetch("/api/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: shareId,
          data: sharedEvent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to share event");
      }

      const result = await response.json();

      if (result.success) {
        // 生成分享链接
        const shareLink = `${window.location.origin}/share/${shareId}`;
        setShareLink(shareLink);

        // 生成二维码
        try {
          const qrURL = await QRCode.toDataURL(shareLink, {
            width: 300,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
          });
          setQRCodeDataURL(qrURL);
        } catch (qrError) {
          console.error("Error generating QR code:", qrError);
        }

        // 存储分享记录到 localStorage 方便后续管理
        const storedShares = JSON.parse(localStorage.getItem("shared-events") || "[]");
        storedShares.push({
          id: shareId,
          eventId: event.id,
          eventTitle: event.title,
          sharedBy: clerkUsername,
          shareDate: new Date().toISOString(),
          shareLink,
        });
        localStorage.setItem("shared-events", JSON.stringify(storedShares));
      } else {
        throw new Error("Failed to share event");
      }
    } catch (error) {
      console.error("Error sharing event:", error);
      toast(language === "zh" ? "分享失败" : "Share Failed", {
        description: error instanceof Error ? error.message : language === "zh" ? "未知错误" : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  // 添加复制分享链接的函数
  const copyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast(language === "zh" ? "链接已复制" : "Link Copied", {
        description: language === "zh" ? "分享链接已复制到剪贴板" : "Share link copied to clipboard",
      });
    }
  };

  // 生成二维码的函数
  const generateQRCode = async () => {
    if (shareLink) {
      try {
        const url = await QRCode.toDataURL(shareLink, {
          width: 300,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
        setQRCodeDataURL(url);
      } catch (error) {
        console.error("Error generating QR code:", error);
      }
    }
  };

  // 下载二维码图片的函数
  const downloadQRCode = () => {
    if (qrCodeDataURL) {
      const link = document.createElement("a");
      link.href = qrCodeDataURL;
      link.download = `${event?.title || "event"}-qrcode.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast(language === "zh" ? "二维码已下载" : "QR Code Downloaded", {
        description: language === "zh" ? "已保存到您的设备" : "Saved to your device",
      });
    }
  };

  const handleShareDialogChange = (open: boolean) => {
    // 当对话框关闭时，重置分享状态（不再重置昵称）
    if (!open) {
      setShareLink("");
      setQRCodeDataURL("");
    }
    setShareDialogOpen(open);
  };

  // 阻止事件冒泡的处理函数
  const handleDialogClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部按钮 */}
        <div className="flex justify-between items-center p-5">
          <div className="w-24"></div> {/* 用于对齐的空白 */}
          <div className="flex space-x-2 ml-auto">
            <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
              <Edit2 className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                // 未登录时不允许打开分享对话框
                if (!isSignedIn) {
                  toast(language === "zh" ? "请先登录" : "Please sign in", {
                    description: language === "zh" ? "登录后才能使用分享功能" : "Sign in required to use share function",
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
            <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8">
              <Trash2 className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 ml-2">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* 显示事件标题和日期 */}
        <div className="px-5 pb-5 flex">
          <div className={cn("w-2 self-stretch rounded-full mr-4", event.color)} />
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-1">{event.title}</h2>
            <p className="text-muted-foreground">{formatDateRange()}</p>
          </div>
        </div>

        {/* 事件详情 */}
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
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={toggleParticipants}
                >
                  <p>
                    {event.participants.filter((p) => p.trim() !== "").length}{" "}
                    {language === "zh" ? "参与者" : "participants"}
                  </p>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      participantsOpen ? "transform rotate-180" : ""
                    )}
                  />
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
                  {language === "zh"
                    ? `${event.notification} 分钟前 按电子邮件`
                    : `${event.notification} minutes before by email`}
                </p>
              </div>
            </div>
          )}

          {event.description && event.description.trim() !== "" && (
            <div className="flex items-start">
              <AlignLeft className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p className="whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* 分享对话框 */}
      <Dialog open={shareDialogOpen} onOpenChange={handleShareDialogChange}>
        <DialogContent className="sm:max-w-md" ref={dialogContentRef} onClick={handleDialogClick}>
          <DialogHeader>
            <DialogTitle>{language === "zh" ? "分享事件" : "Share Event"}</DialogTitle>
          </DialogHeader>
          {!shareLink ? (
            <div className="space-y-4 py-2">
              {/* 显示当前用户信息，无需输入昵称 */}
              <div className="space-y-2">
                <Label htmlFor="shared-by">
                  {language === "zh" ? "分享" : "Share"}
                </Label>
                {/*<Input
                  id="shared-by"
                  value={user ? (user.username || user.firstName) : ""}
                  readOnly
                  onClick={(e) => e.stopPropagation()}
                />*/}
                <p className="text-sm text-muted-foreground">
                  {language === "zh"
                    ? "您将以当前登录身份进行事件分享。"
                    : "You will share this event as your current logged-in identity."}
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShareDialogChange(false);
                  }}
                >
                  {language === "zh" ? "取消" : "Cancel"}
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
                      {language === "zh" ? "分享中..." : "Sharing..."}
                    </span>
                  ) : (
                    <>{language === "zh" ? "分享" : "Share"}</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="share-link">{language === "zh" ? "分享链接" : "Share Link"}</Label>
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
                      {language === "zh" ? "复制" : "Copy"}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {language === "zh"
                      ? "任何拥有此链接的人都可以查看此事件。"
                      : "Anyone with this link can view this event."}
                  </p>
                </div>

                {qrCodeDataURL && (
                  <div className="mt-4 flex flex-col items-center">
                    <Label className="mb-2">{language === "zh" ? "二维码" : "QR Code"}</Label>
                    <div className="border p-3 rounded bg-white mb-2">
                      <img
                        src={qrCodeDataURL || "/placeholder.svg"}
                        alt="QR Code"
                        className="w-full max-w-[200px] mx-auto"
                      />
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
                      {language === "zh" ? "下载二维码" : "Download QR Code"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      {language === "zh"
                        ? "扫描此二维码可立即查看日程"
                        : "Scan this QR code to view the event"}
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
                  {language === "zh" ? "完成" : "Done"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
