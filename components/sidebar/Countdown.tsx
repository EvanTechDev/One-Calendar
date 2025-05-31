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
import { Plus, Edit, Trash, CalendarDays } from "lucide-react";

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
    
    if (repeat === "none") {
      return differenceInDays(targetDate, today);
    }
    
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
    
    if (nextDate < today && repeat === "yearly") {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }
    
    return differenceInDays(nextDate, today);
  };

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        
        {currentCountdown && (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
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
                value={currentCountdown.date}
                onChange={(e) =>
                  setCurrentCountdown({
                    ...currentCountdown,
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
                value={currentCountdown.repeat}
                onValueChange={(value: Countdown["repeat"]) =>
                  setCurrentCountdown({
                    ...currentCountdown,
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
        )}

        <div className="mt-8">
          {countdowns.length === 0 && !currentCountdown ? (
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

        {!currentCountdown && (
          <Button 
            className="fixed bottom-8 right-8 rounded-full w-12 h-12 p-0"
            onClick={newCountdown}
          >
            <Plus className="h-6 w-6" />
          </Button>
        )}

        {currentCountdown && (
          <SheetFooter>
            <Button onClick={handleSave}>{t("save")}</Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
