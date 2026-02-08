"use client";

import { useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
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
import { Plus, ArrowLeft, Edit2, Trash2, Calendar as CalendarIcon, Clock, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { isZhLanguage, translations, useLanguage } from "@/lib/i18n";

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

type TranslationKey = keyof typeof translations["en"]

const colorOptions: { value: string; labelKey: TranslationKey }[] = [
  { value: "bg-red-500", labelKey: "colorRed" },
  { value: "bg-blue-500", labelKey: "colorBlue" },
  { value: "bg-green-500", labelKey: "colorGreen" },
  { value: "bg-yellow-500", labelKey: "colorYellow" },
  { value: "bg-purple-500", labelKey: "colorPurple" },
  { value: "bg-pink-500", labelKey: "colorPink" },
  { value: "bg-indigo-500", labelKey: "colorIndigo" },
  { value: "bg-orange-500", labelKey: "colorOrange" },
];

export function CountdownTool({ open, onOpenChange }: CountdownToolProps) {
  const [countdowns, setCountdowns] = useLocalStorage<Countdown[]>("countdowns", []);
  const [selectedCountdown, setSelectedCountdown] = useState<Countdown | null>(null);
  const [newCountdown, setNewCountdown] = useState<Partial<Countdown>>({
    color: "bg-blue-500"
  });
  const [view, setView] = useState<"list" | "detail" | "edit">("list");
  const [language] = useLanguage();
  const t = translations[language];
  const isZh = isZhLanguage(language);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // useLocalStorage handles persistence.

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return date.toLocaleDateString(isZh ? "zh-CN" : "en-US", options);
  };

  const formatDateLong = (dateStr: string) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString(isZh ? "zh-CN" : "en-US", options);
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

  const tRepeat = (key: Countdown["repeat"]) =>
    ({
      none: t.countdownRepeatNone,
      weekly: t.countdownRepeatWeekly,
      monthly: t.countdownRepeatMonthly,
      yearly: t.countdownRepeatYearly,
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
          <SheetTitle>{t.countdownTitle}</SheetTitle>
        </div>
      </SheetHeader>
      <div className="p-4">
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.countdownSearchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={startAddCountdown}
          className="w-full mb-4 bg-[#0066ff] text-white hover:bg-[#0052CC] border-[#0066ff] green:bg-[#24a854] green:border-[#24a854] orange:bg-[#e26912] orange:border-[#e26912] azalea:bg-[#CD2F7B] azalea:border-[#CD2F7B] pink:bg-[#FFAFA5] pink:border-[#FFAFA5] crimson:bg-[#9B0032] crimson:border-[#9B0032]"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t.countdownAdd}
        </Button>
        <ScrollArea className="h-[calc(100vh-200px)]">
          {countdowns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t.countdownNoEvents}
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
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {formattedDate} • {tRepeat(countdown.repeat)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${daysLeft < 0 ? "text-red-500" : "text-primary"}`}>
                          {Math.abs(daysLeft)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.countdownDaysLeft}
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
            <SheetTitle>{t.countdownDetails}</SheetTitle>
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
                {Math.abs(daysLeft)} {t.countdownDaysLeft}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1 flex items-center">
                <CalendarIcon className="h-4 w-4 mr-1" />
                {t.countdownDate}
              </h3>
              <p className="text-base">{formattedDate}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1 flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {t.countdownRepeat}
              </h3>
              <p className="text-base">{tRepeat(selectedCountdown.repeat)}</p>
            </div>

            {selectedCountdown.description && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {t.countdownDescription}
                </h3>
                <p className="whitespace-pre-wrap text-base">{selectedCountdown.description}</p>
              </div>
            )}
          </div>

          <div className="flex space-x-2 mt-8">
            <Button variant="outline" className="flex-1" onClick={() => startEditCountdown(selectedCountdown)}>
              <Edit2 className="mr-2 h-4 w-4" />
              {t.countdownEdit}
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteCountdown(selectedCountdown.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t.countdownDelete}
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
            {selectedCountdown ? t.countdownEditTitle : t.countdownAddTitle}
          </SheetTitle>
        </div>
      </SheetHeader>
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t.countdownName}*</Label>
            <Input
              id="name"
              value={newCountdown.name || ""}
              onChange={(e) => setNewCountdown({ ...newCountdown, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">{t.countdownColor}*</Label>
            <Select value={newCountdown.color} onValueChange={(value) => setNewCountdown({ ...newCountdown, color: value })}>
              <SelectTrigger id="color">
                <SelectValue placeholder={t.countdownColor} />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center">
                      <div className={cn("w-4 h-4 rounded-full mr-2", option.value)} />
                      {t[option.labelKey]}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.countdownDate}*</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "PPP", { 
                      locale: isZh ? zhCN : enUS
                    })
                  ) : (
                    <span>{t.countdownSelectDate}</span>
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
                  locale={isZh ? zhCN : enUS}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>{t.countdownRepeat}</Label>
            <Select
              value={newCountdown.repeat || "none"}
              onValueChange={(value: Countdown["repeat"]) =>
                setNewCountdown({ ...newCountdown, repeat: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t.countdownRepeat} />
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
            <Label htmlFor="description">{t.countdownDescription}</Label>
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
            {t.countdownDelete}
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
            {t.countdownCancel}
          </Button>
          <Button 
            onClick={saveCountdown} 
            disabled={!newCountdown.name || !selectedDate || !newCountdown.color}
          >
            {t.countdownSave}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] sm:w-[420px] p-0">
        {view === "list" && renderCountdownListView()}
        {view === "detail" && renderCountdownDetailView()}
        {view === "edit" && renderCountdownEditView()}
      </SheetContent>
    </Sheet>
  );
}
