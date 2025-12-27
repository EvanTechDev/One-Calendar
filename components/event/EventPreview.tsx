
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
  const [shareLink, setShareLink] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [qrCodeDataURL, setQRCodeDataURL] = useState<string>("");
  const { isSignedIn, user } = useUser();
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  useEffect(() => {
    if (open && openShareImmediately) {
      if (!isSignedIn) {
        toast(language === "zh" ? "请先登录" : "Please sign in", {
          description:
            language === "zh"
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
    const storedBookmarks = JSON.parse(
      localStorage.getItem("bookmarked-events") || "[]"
    );
    setBookmarks(storedBookmarks);
  }, []);

  useEffect(() => {
    if (event) {
      const isCurrentEventBookmarked = bookmarks.some(
        (bookmark: any) => bookmark.id === event.id
      );
      setIsBookmarked(isCurrentEventBookmarked);
    }
  }, [event, bookmarks]);

  if (!event || !open) return null;

  const getCalendarName = () => {
    const calendar = calendars.find(
      (cal) => cal.id === event.calendarId
    );
    return calendar ? calendar.name : "";
  };

  const formatDateRange = () => {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const dateFormat = "yyyy-MM-dd HH:mm";
    return `${format(startDate, dateFormat, { locale })} – ${format(
      endDate,
      dateFormat,
      { locale }
    )}`;
  };

  const formatNotificationTime = () => {
    if (event.notification === 0)
      return language === "zh" ? "事件开始时" : "At time of event";
    return language === "zh"
      ? `${event.notification} 分钟前`
      : `${event.notification} minutes before`;
  };

  const hasParticipants =
    event.participants &&
    event.participants.length > 0 &&
    event.participants.some((p) => p.trim() !== "");

  const toggleBookmark = () => {
    if (!event) return;
    if (isBookmarked) {
      const updated = bookmarks.filter(
        (bookmark: any) => bookmark.id !== event.id
      );
      localStorage.setItem(
        "bookmarked-events",
        JSON.stringify(updated)
      );
      setBookmarks(updated);
      setIsBookmarked(false);
    } else {
      const updated = [
        ...bookmarks,
        {
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          color: event.color,
          location: event.location,
          bookmarkedAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(
        "bookmarked-events",
        JSON.stringify(updated)
      );
      setBookmarks(updated);
      setIsBookmarked(true);
    }
  };

  const handleShare = async () => {
    if (!event || !user) return;
    try {
      setIsSharing(true);
      const shareId =
        Date.now().toString() +
        Math.random().toString(36).substring(2, 9);
      const sharedEvent = {
        ...event,
        sharedBy:
          user.username || user.firstName || "Anonymous",
      };
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: shareId, data: sharedEvent }),
      });
      const result = await response.json();
      if (!result.success) throw new Error();
      const link = `${window.location.origin}/share/${shareId}`;
      setShareLink(link);
      setQRCodeDataURL(await QRCode.toDataURL(link));
      const stored = JSON.parse(
        localStorage.getItem("shared-events") || "[]"
      );
      stored.push({
        id: shareId,
        eventId: event.id,
        shareLink: link,
      });
      localStorage.setItem(
        "shared-events",
        JSON.stringify(stored)
      );
    } finally {
      setIsSharing(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!event) return;
    const stored = JSON.parse(
      localStorage.getItem("shared-events") || "[]"
    );
    const related = stored.filter(
      (share: any) => share.eventId === event.id
    );
    if (related.length > 0) {
      const confirmed = window.confirm(
        language === "zh"
          ? "该日程已被分享，删除后所有分享链接将失效，是否继续？"
          : "This event has been shared. Deleting it will disable all share links. Continue?"
      );
      if (!confirmed) return;
      try {
        await Promise.all(
          related.map((share: any) =>
            fetch("/api/share", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: share.id }),
            })
          )
        );
        const remaining = stored.filter(
          (share: any) => share.eventId !== event.id
        );
        localStorage.setItem(
          "shared-events",
          JSON.stringify(remaining)
        );
      } catch {
        toast(language === "zh" ? "删除分享失败" : "Delete failed", {
          variant: "destructive",
        });
        return;
      }
    }
    onDelete();
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
        <div className="flex justify-between items-center p-5">
          <div className="w-24" />
          <div className="flex space-x-2 ml-auto">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit2 />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShareDialogOpen(true)}
            >
              <Share2 />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleBookmark}>
              <Bookmark
                className={cn(
                  isBookmarked && "fill-blue-500 text-blue-500"
                )}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteEvent();
              }}
            >
              <Trash2 />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
