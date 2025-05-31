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
      if (nextDate < today) nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (repeat === "yearly") {
      nextDate = new Date(
        today.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate()
      );
      if (nextDate < today) nextDate.setFullYear(today.getFullYear() + 1);
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
        noEvents: "尚未添加任何事件",
      },
    };
    return translations[language][key] || key;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md sm:w-full p-4">
        <SheetHeader>
          <div className="flex items-center">
            <SheetTitle className="font-semibold">{t("title")}</SheetTitle>
          </div>
        </SheetHeader>

        {currentCountdown ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm">
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

            <div>
              <Label htmlFor="date" className="text-sm">
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

            <div>
              <Label htmlFor="repeat" className="text-sm">
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
                  {Object.entries(t("repeatOptions")).map(([key, value) => (
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
                style={{ backgroundColor: "#0066ff", color: "white" }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t(isEditing ? "save" : "add")}
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <Input
                placeholder={t("noEvents")}
                value={contactsFilter}
                onChange={(e) => setContactsFilter(e.target.value)}
                className="w-full"
              />
            </div>

            {countdowns.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {t("noEvents")}
              </div>
            ) : (
              <div className="space-y-3">
                {countdowns.map((countdown) => {
                  const daysLeft = calculateDaysLeft(countdown.date, countdown.repeat);
                  const locale = language === "zh" ? zhCN : enUS;
                  const formattedDate = format(parseISO(countdown.date), "MMM d, yyyy", { locale });
                  const daysColor = daysLeft < 0 ? "text-red-500" : "text-[#0066ff]";

                  return (
                    <div
                      key={countdown.id}
                      className="flex justify-between items-start p-2 hover:bg-accent rounded-md cursor-pointer"
                    >
                      <div>
                        <div className="font-medium">{countdown.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formattedDate}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${daysColor}`}>
                          {Math.abs(daysLeft)} {t("daysLeft")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              className="mt-6 w-full"
              onClick={newCountdown}
              variant="default"
              style={{ backgroundColor: "#0066ff", color: "white" }}
              size="sm"
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
