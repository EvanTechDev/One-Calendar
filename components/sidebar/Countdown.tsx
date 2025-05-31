"use client";
import { useState, useEffect } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Sheet,
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CountdownTool({ open, onOpenChange }: CountdownToolProps) {
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [currentCountdown, setCurrentCountdown] = useState<Countdown | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [language, setLanguage] = useState<"en" | "zh">("en");

  useEffect(() => {
    const userLanguage = navigator.language.startsWith("zh") ? "zh" : "en";
    setLanguage(userLanguage);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("countdowns");
    if (saved) {
      setCountdowns(JSON.parse(saved));
    }
  }, []);

  const saveCountdowns = (data: Countdown[]) => {
    setCountdowns(data);
    localStorage.setItem("countdowns", JSON.stringify(data));
  };

  const newCountdown = () => {
    setCurrentCountdown({
      id: Date.now().toString(),
      name: "",
      date: format(new Date(), "yyyy-MM-dd"),
      repeat: "none",
    });
    setIsEditing(false);
  };

  const editCountdown = (id: string) => {
    const countdown = countdowns.find((c) => c.id === id);
    if (countdown) {
      setCurrentCountdown(countdown);
      setIsEditing(true);
    }
  };

  const deleteCountdown = (id: string) => {
    saveCountdowns(countdowns.filter((c) => c.id !== id));
  };

  const handleSave = () => {
    if (!currentCountdown?.name || !currentCountdown.date) return;
    if (isEditing) {
      saveCountdowns(
        countdowns.map((c) => (c.id === currentCountdown.id ? currentCountdown : c))
      );
    } else {
      saveCountdowns([...countdowns, currentCountdown]);
    }
    setCurrentCountdown(null);
  };

  const calculateDaysLeft = (dateStr: string, repeat: Countdown["repeat"]) => {
    const today = new Date();
    const targetDate = parseISO(dateStr);
    
    // 处理重复周期计算
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
    } else if (repeat === "yearly") {
      nextDate = new Date(
        today.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate()
      );
      if (nextDate < today) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
    }
    
    return differenceInDays(nextDate, today);
  };

  const t = (key: string) => {
    const translations = {
      en: {
        title: "Countdown",
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
        title: "倒数日",
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold mb-4">{t("title")}</SheetTitle>
        </SheetHeader>

        {currentCountdown ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                {t("name")}
              </Label>
              <Input
                id="name"
                value={currentCountdown.name}
                onChange={(e) =>
                  setCurrentCountdown({
                    ...currentCountdown,
                    name: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-medium">
                {t("date")}
              </Label>
              <Input
                id="date"
                type="date"
                value={currentCountdown.date}
                onChange={(e) =>
                  setCurrentCountdown({
                    ...currentCountdown,
                    date: e.target.value,
                  })
                }
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="repeat" className="text-sm font-medium">
                {t("repeat")}
              </Label>
              <Select
                value={currentCountdown.repeat}
                onValueChange={(value: Countdown["repeat"]) =>
                  setCurrentCountdown({
                    ...currentCountdown,
                    repeat: value,
                  })
                }
              >
                <SelectTrigger>
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

            <SheetFooter className="mt-6">
              <Button 
                onClick={handleSave} 
                className="w-full"
                style={{ color: "#0066ff" }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t(isEditing ? "save" : "add")}
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <>
            <div className="mt-6">
              {countdowns.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  {t("noEvents")}
                </p>
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
                    
                    // 使用自定义颜色类
                    const daysColor = daysLeft < 0 ? "text-red-500" : "text-[#0066ff]";
                    
                    return (
                      <div
                        key={countdown.id}
                        className="border rounded-md p-4 hover:bg-accent transition-colors"
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
                              className={`text-lg font-bold ${daysColor}`}
                            >
                              {Math.abs(daysLeft)} {t("daysLeft")}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2 mt-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editCountdown(countdown.id)}
                            className="text-[#0066ff] hover:text-[#0066ff]/80"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {t("edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCountdown(countdown.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash className="h-4 w-4 mr-2" />
                            {t("delete")}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Button
              className="mt-6 w-full"
              onClick={newCountdown}
              variant="default"
              style={{ backgroundColor: "#0066ff", color: "white" }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("add")}
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
