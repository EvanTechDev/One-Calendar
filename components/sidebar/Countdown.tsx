"use client";

import { useState, useEffect } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Plus, Edit, Trash } from "lucide-react";

interface Countdown {
  id: string;
  name: string;
  date: string;
  repeat: "none" | "weekly" | "monthly" | "yearly";
}

interface CountdownToolProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function CountdownTool({ 
  open: externalOpen, 
  onOpenChange: externalOnOpenChange,
  trigger
}: CountdownToolProps) {
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [currentCountdown, setCurrentCountdown] = useState<Countdown | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;
  const [language, setLanguage] = useState<"en" | "zh">("en");
  
  const setIsOpen = (open: boolean) => {
    if (!isControlled) {
      setInternalOpen(open);
    }
    externalOnOpenChange?.(open);
  };


  // 检测浏览器语言
  useEffect(() => {
    const userLanguage = navigator.language.startsWith("zh") ? "zh" : "en";
    setLanguage(userLanguage);
  }, []);

  // 加载保存的倒数日
  useEffect(() => {
    const saved = localStorage.getItem("countdowns");
    if (saved) {
      setCountdowns(JSON.parse(saved));
    }
  }, []);

  // 保存倒数日到 localStorage
  const saveCountdowns = (data: Countdown[]) => {
    setCountdowns(data);
    localStorage.setItem("countdowns", JSON.stringify(data));
  };

  // 初始化新倒数日
  const newCountdown = () => {
    setCurrentCountdown({
      id: Date.now().toString(),
      name: "",
      date: format(new Date(), "yyyy-MM-dd"),
      repeat: "none",
    });
    setIsEditing(false);
    setIsOpen(true);
  };

  // 编辑倒数日
  const editCountdown = (id: string) => {
    const countdown = countdowns.find((c) => c.id === id);
    if (countdown) {
      setCurrentCountdown(countdown);
      setIsEditing(true);
      setIsOpen(true);
    }
  };

  // 删除倒数日
  const deleteCountdown = (id: string) => {
    saveCountdowns(countdowns.filter((c) => c.id !== id));
  };

  // 保存或更新倒数日
  const handleSave = () => {
    if (!currentCountdown?.name || !currentCountdown.date) return;

    if (isEditing) {
      saveCountdowns(
        countdowns.map((c) => (c.id === currentCountdown.id ? currentCountdown : c))
      );
    } else {
      saveCountdowns([...countdowns, currentCountdown]);
    }
    setIsOpen(false);
  };

  // 计算剩余天数
  const calculateDaysLeft = (dateStr: string, repeat: Countdown["repeat"]) => {
    const today = new Date();
    const targetDate = parseISO(dateStr);
    
    if (repeat === "none") {
      return differenceInDays(targetDate, today);
    }
    
    // 对于重复事件，计算今年的日期
    let nextDate = new Date(
      today.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    );
    
    if (repeat === "weekly") {
      const targetDay = targetDate.getDay();
      const todayDay = today.getDay();
      const daysToAdd = (targetDay - todayDay + 7) % 7;
      nextDate = new Date(today);
      nextDate.setDate(today.getDate() + daysToAdd);
    } else if (repeat === "monthly") {
      nextDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        targetDate.getDate()
      );
      if (nextDate < today) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
    }
    
    // 如果今年的日期已经过去，计算明年的
    if (nextDate < today && repeat === "yearly") {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }
    
    return differenceInDays(nextDate, today);
  };

  // 获取本地化字符串
  const t = (key: string) => {
    const translations = {
      en: {
        title: "Countdown Tool",
        add: "Add Countdown",
        name: "Event Name",
        date: "Date",
        repeat: "Repeat",
        repeatOptions: {
          none: "None",
          weekly: "Weekly",
          monthly: "Monthly",
          yearly: "Yearly",
        },
        save: "Save",
        daysLeft: "days left",
        edit: "Edit",
        delete: "Delete",
        details: "Details",
        noEvents: "No events added yet",
      },
      zh: {
        title: "倒数日工具",
        add: "添加倒数日",
        name: "事件名称",
        date: "日期",
        repeat: "重复",
        repeatOptions: {
          none: "不重复",
          weekly: "每周",
          monthly: "每月",
          yearly: "每年",
        },
        save: "保存",
        daysLeft: "天后",
        edit: "编辑",
        delete: "删除",
        details: "详情",
        noEvents: "尚未添加任何事件",
      },
    };
    return translations[language][key] || key;
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        {trigger ? (
          <SheetTrigger asChild>
            {trigger}
          </SheetTrigger>
        ) : (
          <SheetTrigger asChild>
            <Button variant="outline" onClick={newCountdown}>
              <Plus className="mr-2 h-4 w-4" /> {t("add")}
            </Button>
          </SheetTrigger>
        )}
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {isEditing ? t("edit") : t("add")}
            </SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                {t("name")}
              </Label>
              <Input
                id="name"
                value={currentCountdown?.name || ""}
                onChange={(e) =>
                  setCurrentCountdown({
                    ...currentCountdown!,
                    name: e.target.value,
                  })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                {t("date")}
              </Label>
              <Input
                id="date"
                type="date"
                value={currentCountdown?.date || ""}
                onChange={(e) =>
                  setCurrentCountdown({
                    ...currentCountdown!,
                    date: e.target.value,
                  })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="repeat" className="text-right">
                {t("repeat")}
              </Label>
              <Select
                value={currentCountdown?.repeat || "none"}
                onValueChange={(value: Countdown["repeat"]) =>
                  setCurrentCountdown({
                    ...currentCountdown!,
                    repeat: value,
                  })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={t("repeat")} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(t("repeatOptions")).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter>
            <Button onClick={handleSave}>{t("save")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">{t("title")}</h2>
        {countdowns.length === 0 ? (
          <p className="text-gray-500">{t("noEvents")}</p>
        ) : (
          <div className="space-y-4">
            {countdowns.map((countdown) => {
              const daysLeft = calculateDaysLeft(countdown.date, countdown.repeat);
              const locale = language === "zh" ? zhCN : enUS;
              const formattedDate = format(
                parseISO(countdown.date),
                "MMM d, yyyy",
                { locale }
              );

              return (
                <div
                  key={countdown.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{countdown.name}</h3>
                      <p className="text-sm text-gray-500">
                        {formattedDate} • {t(`repeatOptions.${countdown.repeat}`)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-bold ${
                          daysLeft < 0 ? "text-red-500" : "text-green-500"
                        }`}
                      >
                        {Math.abs(daysLeft)} {t("daysLeft")}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editCountdown(countdown.id)}
                    >
                      <Edit className="h-4 w-4 mr-2" /> {t("edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteCountdown(countdown.id)}
                    >
                      <Trash className="h-4 w-4 mr-2" /> {t("delete")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
