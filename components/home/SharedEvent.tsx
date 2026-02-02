"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import {
  MapPin,
  Users,
  Calendar,
  Bell,
  AlignLeft,
  Loader2,
  Clock,
  CalendarPlus,
  ExternalLink,
  Copy,
  AlertCircle,
  Home,
  Lock,
  Flame,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { translations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useCalendar } from "@/components/context/CalendarContext";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SharedEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  location?: string;
  participants: string[];
  notification: number;
  description?: string;
  color: string;
  calendarId: string;
  sharedBy: string;
}

interface SharedEventViewProps {
  shareId: string;
}

function getDarkerColorClass(color: string) {
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
  
  return colorMapping[color] || '#3A3A3A';
}

export default function SharedEventView({ shareId }: SharedEventViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [language] = useLanguage();
  const t = translations[language];

  const [event, setEvent] = useState<SharedEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [requiresPassword, setRequiresPassword] = useState(false);
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const { calendars, events, setEvents } = useCalendar();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchSharedEvent = async () => {
      try {
        setLoading(true);
        setError(null);
        setEvent(null);
        setRequiresPassword(false);
        setBurnAfterRead(false);
        setPassword("");
        setPasswordSubmitting(false);
        setPasswordError(null);

        if (!shareId) {
          setError("No share ID provided");
          return;
        }

        const response = await fetch(`/api/share?id=${encodeURIComponent(shareId)}`);

        if (!response.ok) {
          if (response.status === 401) {
            const payload = await response.json().catch(() => null);
            if (payload?.requiresPassword) {
              setRequiresPassword(true);
              setBurnAfterRead(!!payload?.burnAfterRead);
              return;
            }
          }
          setError(response.status === 404 ? "Shared event not found" : "Failed to load shared event");
          return;
        }

        const result = await response.json();
        if (!result?.success || !result?.data) {
          setError("Invalid share data");
          return;
        }

        const eventData = typeof result.data === "object" ? result.data : JSON.parse(result.data);
        setEvent(eventData);
        setBurnAfterRead(!!result?.burnAfterRead);
      } catch {
        setError("Failed to load shared event");
      } finally {
        setLoading(false);
      }
    };

    fetchSharedEvent();
  }, [shareId]);

  const tryDecryptWithPassword = async () => {
    if (!shareId) return;

    const pwd = password;
    if (!pwd) {
      setPasswordError(language === "zh" ? "请输入密码" : "Please enter a password");
      return;
    }

    try {
      setPasswordSubmitting(true);
      setPasswordError(null);

      const url = `/api/share?id=${encodeURIComponent(shareId)}&password=${encodeURIComponent(pwd)}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401) {
          const payload = await response.json().catch(() => null);
          setBurnAfterRead(!!payload?.burnAfterRead);
          setPasswordError(language === "zh" ? "需要密码" : "Password required");
          setRequiresPassword(true);
          return;
        }
        if (response.status === 403) {
          setPasswordError(language === "zh" ? "密码错误" : "Invalid password");
          setRequiresPassword(true);
          return;
        }
        if (response.status === 404) {
          setPasswordError(language === "zh" ? "分享不存在或已被销毁" : "Share not found or already destroyed");
          setRequiresPassword(true);
          return;
        }
        setPasswordError(language === "zh" ? "解密失败" : "Failed to decrypt");
        setRequiresPassword(true);
        return;
      }

      const result = await response.json();
      if (!result?.success || !result?.data) {
        setPasswordError(language === "zh" ? "数据无效" : "Invalid data");
        setRequiresPassword(true);
        return;
      }

      const eventData = typeof result.data === "object" ? result.data : JSON.parse(result.data);
      setEvent(eventData);
      setBurnAfterRead(!!result?.burnAfterRead);
      setRequiresPassword(false);
      setPasswordError(null);

      if (result?.burnAfterRead) {
        toast({
          title: language === "zh" ? "阅后即焚" : "Burn after read",
          description: language === "zh" ? "已成功查看，该分享已从服务器删除。" : "Viewed successfully. This share has been deleted from the server.",
        });
      }
    } catch {
      setPasswordError(language === "zh" ? "解密失败" : "Failed to decrypt");
      setRequiresPassword(true);
    } finally {
      setPasswordSubmitting(false);
      setLoading(false);
    }
  };

  const formatDateWithTimezone = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "yyyy-MM-dd HH:mm", { locale: language === "zh" ? zhCN : enUS });
  };

  const handleAddToCalendar = async () => {
    if (!event) return;

    try {
      setIsAdding(true);

      let targetCalendarId = event.calendarId;
      const calendarExists = calendars.some((cal) => cal.id === targetCalendarId);
      if (!calendarExists) targetCalendarId = calendars[0]?.id ?? "default";

      const newEvent = {
        ...event,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
        calendarId: targetCalendarId,
      };

      setEvents([...events, newEvent]);

      toast({
        title: language === "zh" ? "添加成功" : "Added Successfully",
        description: language === "zh" ? "事件已添加到您的日历" : "Event has been added to your calendar",
      });

      setTimeout(() => router.push("/"), 1500);
    } catch (e) {
      toast({
        title: language === "zh" ? "添加失败" : "Add Failed",
        description: e instanceof Error ? e.message : language === "zh" ? "未知错误" : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast({
      title: language === "zh" ? "链接已复制" : "Link Copied",
      description: language === "zh" ? "分享链接已复制到剪贴板" : "Share link copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="fixed -z-10 inset-0">
          <div className="absolute inset-0 bg-white dark:bg-black">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)`,
                backgroundSize: "24px 24px",
              }}
            />
            <div
              className="absolute inset-0 dark:block hidden"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
                backgroundSize: "24px 24px",
              }}
            />
          </div>
        </div>
        <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
        <p className="mt-6 text-lg font-medium text-gray-600 dark:text-gray-300">
          {language === "zh" ? "加载中..." : "Loading..."}
        </p>
      </div>
    );
  }

  if (requiresPassword && !event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="fixed -z-10 inset-0">
          <div className="absolute inset-0 bg-white dark:bg-black">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)`,
                backgroundSize: "24px 24px",
              }}
            />
            <div
              className="absolute inset-0 dark:block hidden"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
                backgroundSize: "24px 24px",
              }}
            />
          </div>
        </div>

        <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
          <a href="/" className="flex items-center gap-2 self-center font-medium">
          <Calendar className="size-4" color="#0066ff" />
          One Calendar
        </a>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Card className="max-w-md w-full overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center gap-3 mb-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-full p-4 mx-auto w-fit">
                    <Lock className="h-10 w-10 text-blue-500 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-2xl font-bold">
                    {language === "zh" ? "此分享已加密" : "This share is encrypted"}
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    {burnAfterRead
                      ? language === "zh"
                        ? "该分享为阅后即焚：正确解密后将自动删除。"
                        : "This share is burn-after-read: it will be deleted after a successful decrypt."
                      : language === "zh"
                        ? "请输入密码以解密并查看事件内容。"
                        : "Enter the password to decrypt and view the event."}
                  </CardDescription>

                  {burnAfterRead && (
                    <div className="mt-2 inline-flex items-center gap-2 text-sm text-red-500">
                      <Flame className="h-4 w-4" />
                      {language === "zh" ? "阅后即焚已启用" : "Burn after read enabled"}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="share-password">{language === "zh" ? "密码" : "Password"}</Label>
                    <Input
                      id="share-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") tryDecryptWithPassword();
                      }}
                      placeholder={language === "zh" ? "输入分享密码" : "Enter share password"}
                    />
                    {passwordError ? (
                      <p className="text-sm text-red-500">{passwordError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {language === "zh" ? "密码错误将无法解密。" : "Wrong password cannot be decrypted."}
                      </p>
                    )}
                  </div>

                  <Button className="w-full" onClick={tryDecryptWithPassword} disabled={passwordSubmitting}>
                    {passwordSubmitting ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {language === "zh" ? "解密中..." : "Decrypting..."}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        {language === "zh" ? "解密并查看" : "Decrypt & View"}
                      </span>
                    )}
                  </Button>

                  <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
                    <Home className="mr-2 h-4 w-4" />
                    {language === "zh" ? "返回主页" : "Return to Home"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="fixed -z-10 inset-0">
          <div className="absolute inset-0 bg-white dark:bg-black">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)`,
                backgroundSize: "24px 24px",
              }}
            />
            <div
              className="absolute inset-0 dark:block hidden"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
                backgroundSize: "24px 24px",
              }}
            />
          </div>
        </div>

        <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
          <a href="/" className="flex items-center gap-2 self-center font-medium">
          <Calendar className="size-4" color="#0066ff" />
          One Calendar
        </a>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Card className="max-w-md w-full overflow-hidden">
              <CardContent className="p-6 text-center">
                <div className="bg-red-50 dark:bg-red-900/20 rounded-full p-4 mx-auto w-fit">
                  <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400" />
                </div>
                <CardTitle className="text-2xl font-bold text-red-500 mb-4">
                  {language === "zh" ? "事件未找到" : "Event Not Found"}
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300 mb-6 text-left">
                  {language === "zh"
                    ? "无法加载共享的日历事件。该链接可能已过期、无效或已被阅后即焚销毁。"
                    : "Unable to load the shared calendar event. The link may be expired, invalid, or already destroyed."}
                </CardDescription>
                <Button onClick={() => router.push("/")} className="w-full">
                  <Home className="mr-2 h-4 w-4" />
                  {language === "zh" ? "返回主页" : "Return to Home"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const durationText =
    language === "zh"
      ? `${durationHours > 0 ? `${durationHours}小时` : ""}${durationMinutes > 0 ? ` ${durationMinutes}分钟` : ""}`
      : `${durationHours > 0 ? `${durationHours}h` : ""}${durationMinutes > 0 ? ` ${durationMinutes}m` : ""}`;

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4">
      <div className="fixed -z-10 inset-0">
        <div className="absolute inset-0 bg-white dark:bg-black">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />
          <div
            className="absolute inset-0 dark:block hidden"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />
        </div>
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex items-center gap-2 self-center font-medium">
          <Calendar className="size-4" color="#0066ff" />
          One Calendar
        </a>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="max-w-md w-full overflow-hidden">
            <div className="relative">
              <div className={cn("absolute left-0 top-0 h-full w-1")} style={{ backgroundColor: getDarkerColorClass(event.color) }}/>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <CardTitle className="text-2xl font-bold mb-1">{event.title}</CardTitle>
                    <CardDescription>
                      {language === "zh" ? "分享者：" : "Shared by: "}
                      <span className="font-medium">{event.sharedBy}</span>
                    </CardDescription>
                    {burnAfterRead && (
                      <div className="mt-2 inline-flex items-center gap-2 text-sm text-red-500">
                        <Flame className="h-4 w-4" />
                        {language === "zh" ? "此分享为阅后即焚（已在服务器删除）" : "Burn-after-read (deleted from server)"}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{durationText}</span>
                  </Badge>
                </div>

                <Card className="bg-muted mb-6">
                  <CardContent className="p-4 flex items-start">
                    <Calendar className="h-5 w-5 mr-3 mt-0.5 text-primary" />
                    <div>
                      <p className="font-medium">{formatDateWithTimezone(event.startDate)}</p>
                      <p className="text-muted-foreground">
                        {language === "zh" ? "至" : "to"} {formatDateWithTimezone(event.endDate)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-5">
                  {event.location && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="flex items-start"
                    >
                      <MapPin className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                      <p>{event.location}</p>
                    </motion.div>
                  )}

                  {event.participants?.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                      className="flex items-start"
                    >
                      <Users className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                      <p>{event.participants.join(", ")}</p>
                    </motion.div>
                  )}

                  {event.notification > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.3 }}
                      className="flex items-start"
                    >
                      <Bell className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                      <p>{language === "zh" ? `提前 ${event.notification} 分钟提醒` : `${event.notification} minutes before`}</p>
                    </motion.div>
                  )}

                  {event.description && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.4 }}
                      className="flex items-start"
                    >
                      <AlignLeft className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                      <p className="whitespace-pre-wrap">{event.description}</p>
                    </motion.div>
                  )}
                </div>

                <div className="mt-8 space-y-3">
                  <Button className="w-full" variant="default" onClick={handleAddToCalendar} disabled={isAdding}>
                    {isAdding ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {language === "zh" ? "添加中..." : "Adding..."}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <CalendarPlus className="mr-2 h-5 w-5" />
                        {language === "zh" ? "添加到我的日历" : "Add to My Calendar"}
                      </span>
                    )}
                  </Button>

                  <Button variant="outline" className="w-full" onClick={copyLink}>
                    <Copy className="mr-2 h-4 w-4" />
                    {copied ? (language === "zh" ? "已复制!" : "Copied!") : language === "zh" ? "复制分享链接" : "Copy Share Link"}
                  </Button>
                </div>
              </CardContent>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
