"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, ArrowLeft, Edit2, Trash2, Calendar, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";

interface Countdown {
  id: string;
  name: string;
  date: string;
  repeat: "none" | "weekly" | "monthly" | "yearly";
  description?: string;
  color: string;
}

interface CountdownToolProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const colorOptions = [
  { value: "bg-red-500", label: "红色", labelEn: "Red" },
  { value: "bg-blue-500", label: "蓝色", labelEn: "Blue" },
  { value: "bg-green-500", label: "绿色", labelEn: "Green" },
  { value: "bg-yellow-500", label: "黄色", labelEn: "Yellow" },
  { value: "bg-purple-500", label: "紫色", labelEn: "Purple" },
  { value: "bg-pink-500", label: "粉色", labelEn: "Pink" },
  { value: "bg-indigo-500", label: "靛蓝", labelEn: "Indigo" },
  { value: "bg-orange-500", label: "橙色", labelEn: "Orange" },
];

export function CountdownTool({ open, onOpenChange }: CountdownToolProps) {
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [selectedCountdown, setSelectedCountdown] = useState<Countdown | null>(null);
  const [newCountdown, setNewCountdown] = useState<Partial<Countdown>>({
    color: "bg-blue-500"
  });
  const [view, setView] = useState<"list" | "detail" | "edit">("list");
  const [language, setLanguage] = useState<"en" | "zh">("en");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    const userLanguage = navigator.language.startsWith("zh") ? "zh" : "en";
    setLanguage(userLanguage);
  }, []);

  // 从 localStorage 加载数据
  useEffect(() => {
    const savedCountdowns = localStorage.getItem('countdowns');
    if (savedCountdowns) {
      try {
        const parsedCountdowns = JSON.parse(savedCountdowns);
        setCountdowns(parsedCountdowns);
      } catch (error) {
        console.error('Error parsing saved countdowns:', error);
        setCountdowns([]);
      }
    }
  }, []);

  // 保存数据到 localStorage
  useEffect(() => {
    if (countdowns.length >= 0) {
      localStorage.setItem('countdowns', JSON.stringify(countdowns));
    }
  }, [countdowns]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return date.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", options);
  };

  const formatDateLong = (dateStr: string) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", options);
  };

  const calculateDaysLeft = (dateStr: string, repeat: Countdown["repeat"]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(dateStr);
    let nextDate = new Date(today.getFullYear(), targetDate.getMonth(), targetDate.getDate());

    if (repeat === "weekly") {
      const targetDay = targetDate.getDay();
      const todayDay = today.getDay();
      const daysToAdd = (targetDay - todayDay + 7) % 7;
      nextDate = new Date(today);
      nextDate.setDate(today.getDate() + daysToAdd);
    } else if (repeat === "monthly") {
      nextDate = new Date(today.getFullYear(), today.getMonth(), targetDate.getDate());
      if (nextDate < today) nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (repeat === "yearly") {
      nextDate = new Date(today.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      if (nextDate < today) nextDate.setFullYear(today.getFullYear() + 1);
    }

    const diffTime = nextDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const t = (key: string) => {
    const translations = {
      en: {
        title: "Countdown",
        add: "Add Countdown",
        name: "Event Name",
        date: "Date",
        repeat: "Repeat",
        description: "Description",
        color: "Color",
        repeatOptions: {
          none: "None",
          weekly: "Weekly", 
          monthly: "Monthly",
          yearly: "Yearly",
        },
        save: "Save",
        edit: "Edit",
        delete: "Delete",
        cancel: "Cancel",
        daysLeft: "days left",
        noEvents: "No events yet",
        searchPlaceholder: "Search events...",
        countdownDetails: "Countdown Details",
        editCountdown: "Edit Countdown",
        addCountdown: "Add Countdown",
        selectDate: "Select date",
      },
      zh: {
        title: "倒数日",
        add: "添加倒数日",
        name: "事件名称",
        date: "日期", 
        repeat: "重复",
        description: "描述",
        color: "颜色",
        repeatOptions: {
          none: "不重复",
          weekly: "每周",
          monthly: "每月",
          yearly: "每年",
        },
        save: "保存",
        edit: "编辑",
        delete: "删除",
        cancel: "取消",
        daysLeft: "天后",
        noEvents: "暂无事件",
        searchPlaceholder: "搜索事件...",
        countdownDetails: "倒数日详情",
        editCountdown: "编辑倒数日",
        addCountdown: "添加倒数日",
        selectDate: "选择日期",
      },
    };
    const lang = translations[language];
    return lang?.[key] ?? key;
  };

  const tRepeat = (key: Countdown["repeat"]) =>
    ({
      none: t("repeatOptions")["none"],
      weekly: t("repeatOptions")["weekly"],
      monthly: t("repeatOptions")["monthly"],
      yearly: t("repeatOptions")["yearly"],
    }[key]);

  const startAddCountdown = () => {
    const today = new Date();
    setNewCountdown({
      name: "",
      date: getTodayDateString(),
      repeat: "none",
      description: "",
      color: "bg-blue-500"
    });
    setSelectedDate(today);
    setSelectedCountdown(null);
    setView("edit");
  };

  const viewCountdownDetail = (countdown: Countdown) => {
    setSelectedCountdown(countdown);
    setView("detail");
  };

  const startEditCountdown = (countdown: Countdown) => {
    setNewCountdown(countdown);
    setSelectedDate(new Date(countdown.date));
    setView("edit");
  };

  const backToCountdownList = () => {
    setView("list");
    setSelectedCountdown(null);
  };

  const saveCountdown = () => {
    if (!newCountdown.name || !selectedDate || !newCountdown.color) return;
    
    const countdown: Countdown = {
      id: selectedCountdown?.id || Date.now().toString(),
      name: newCountdown.name,
      date: selectedDate.toISOString().split('T')[0],
      repeat: newCountdown.repeat || "none",
      description: newCountdown.description || "",
      color: newCountdown.color
    };

    if (selectedCountdown) {
      setCountdowns(prev => prev.map(c => c.id === countdown.id ? countdown : c));
    } else {
      setCountdowns(prev => [...prev, countdown]);
    }

    setView("list");
    setSelectedCountdown(null);
    setNewCountdown({ color: "bg-blue-500" });
    setSelectedDate(new Date());
  };

  const deleteCountdown = (id: string) => {
    setCountdowns(prev => prev.filter(c => c.id !== id));
    setView("list");
    setSelectedCountdown(null);
  };

  // 渲染倒数日列表视图
  const renderCountdownListView = () => (
    <>
      <SheetHeader className="p-4 border-b">
        <div className="flex items-center justify-between">
          <SheetTitle>{t("title")}</SheetTitle>
        </div>
        <div className="mt-2">
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
      </SheetHeader>
      <div className="p-4">
        <Button variant="outline" size="sm" onClick={startAddCountdown} className="w-full mb-4">
          <Plus className="mr-2 h-4 w-4" />
          {t("add")}
        </Button>
        <ScrollArea className="h-[calc(100vh-200px)]">
          {countdowns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("noEvents")}
            </div>
          ) : (
            <div className="space-y-2">
              {countdowns
                .filter((countdown) =>
                  countdown.name.toLowerCase().includes(search.toLowerCase()) ||
                  countdown.description?.toLowerCase().includes(search.toLowerCase())
                )
                .map((countdown) => {
                  const daysLeft = calculateDaysLeft(countdown.date, countdown.repeat);
                  const formattedDate = formatDate(countdown.date);
                  
                  return (
                    <div
                      key={countdown.id}
                      className="flex items-center p-3 hover:bg-accent rounded-md cursor-pointer border border-border/50"
                      onClick={() => viewCountdownDetail(countdown)}
                    >
                      <Avatar className="h-12 w-12 mr-3">
                        <AvatarFallback className={countdown.color}>
                          <span className="text-white font-semibold">
                            {countdown.name.charAt(0).toUpperCase()}
                          </span>
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium">{countdown.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formattedDate} • {tRepeat(countdown.repeat)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${daysLeft < 0 ? "text-red-500" : "text-primary"}`}>
                          {Math.abs(daysLeft)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("daysLeft")}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  );

  // 渲染倒数日详情视图
  const renderCountdownDetailView = () => {
    if (!selectedCountdown) return null;
    const daysLeft = calculateDaysLeft(selectedCountdown.date, selectedCountdown.repeat);
    const formattedDate = formatDateLong(selectedCountdown.date);

    return (
      <>
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="mr-2" onClick={backToCountdownList}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle>{t("countdownDetails")}</SheetTitle>
          </div>
        </SheetHeader>
        <div className="p-4">
          <div className="flex items-center mb-6">
            <Avatar className="h-16 w-16 mr-4">
              <AvatarFallback className={selectedCountdown.color}>
                <span className="text-white text-xl font-bold">
                  {selectedCountdown.name.charAt(0).toUpperCase()}
                </span>
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold">{selectedCountdown.name}</h2>
              <div className={`text-2xl font-bold mt-1 ${daysLeft < 0 ? "text-red-500" : "text-primary"}`}>
                {Math.abs(daysLeft)} {t("daysLeft")}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1 flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {t("date")}
              </h3>
              <p className="text-base">{formattedDate}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1 flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {t("repeat")}
              </h3>
              <p className="text-base">{tRepeat(selectedCountdown.repeat)}</p>
            </div>

            {selectedCountdown.description && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {t("description")}
                </h3>
                <p className="whitespace-pre-wrap text-base">{selectedCountdown.description}</p>
              </div>
            )}
          </div>

          <div className="flex space-x-2 mt-8">
            <Button variant="outline" className="flex-1" onClick={() => startEditCountdown(selectedCountdown)}>
              <Edit2 className="mr-2 h-4 w-4" />
              {t("edit")}
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteCountdown(selectedCountdown.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t("delete")}
            </Button>
          </div>
        </div>
      </>
    );
  };

  // 渲染倒数日编辑视图
  const renderCountdownEditView = () => (
    <div className="h-full flex flex-col">
      <SheetHeader className="p-4 border-b">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2"
            onClick={() => {
              if (selectedCountdown) {
                setView("detail");
              } else {
                setView("list");
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <SheetTitle>
            {selectedCountdown ? t("editCountdown") : t("addCountdown")}
          </SheetTitle>
        </div>
      </SheetHeader>
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("name")}*</Label>
            <Input
              id="name"
              value={newCountdown.name || ""}
              onChange={(e) => setNewCountdown({ ...newCountdown, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">{t("color")}*</Label>
            <Select value={newCountdown.color} onValueChange={(value) => setNewCountdown({ ...newCountdown, color: value })}>
              <SelectTrigger id="color">
                <SelectValue placeholder={t("color")} />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center">
                      <div className={cn("w-4 h-4 rounded-full mr-2", option.value)} />
                      {language === "zh" ? option.label : option.labelEn}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("date")}*</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "PPP", { 
                      locale: language === "zh" ? zhCN : enUS 
                    })
                  ) : (
                    <span>{t("selectDate")}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setCalendarOpen(false);
                  }}
                  initialFocus
                  locale={language === "zh" ? zhCN : enUS}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>{t("repeat")}</Label>
            <Select
              value={newCountdown.repeat || "none"}
              onValueChange={(value: Countdown["repeat"]) =>
                setNewCountdown({ ...newCountdown, repeat: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("repeat")} />
              </SelectTrigger>
              <SelectContent>
                {["none", "weekly", "monthly", "yearly"].map((key) => (
                  <SelectItem key={key} value={key}>
                    {tRepeat(key as Countdown["repeat"])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              value={newCountdown.description || ""}
              onChange={(e) => setNewCountdown({ ...newCountdown, description: e.target.value })}
              rows={3}
            />
          </div>
        </div>
      </div>
      <div className="p-4 border-t flex justify-between">
        {selectedCountdown && (
          <Button variant="destructive" onClick={() => deleteCountdown(selectedCountdown.id)}>
            {t("delete")}
          </Button>
        )}
        <div className="flex space-x-2 ml-auto">
          <Button
            variant="outline"
            onClick={() => {
              if (selectedCountdown) {
                setView("detail");
              } else {
                setView("list");
              }
            }}
          >
            {t("cancel")}
          </Button>
          <Button 
            onClick={saveCountdown} 
            disabled={!newCountdown.name || !selectedDate || !newCountdown.color}
          >
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md p-0">
        {view === "list" && renderCountdownListView()}
        {view === "detail" && renderCountdownDetailView()}
        {view === "edit" && renderCountdownEditView()}
      </SheetContent>
    </Sheet>
  );
}
