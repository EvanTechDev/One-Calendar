"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, parse, isValid, set, getHours, getMinutes } from "date-fns";
import { ArrowRight, Calendar as CalendarIcon, Clock } from "lucide-react";
import { isZhLanguage, translations, type Language } from "@/lib/i18n";
import { useCalendar } from "@/components/providers/calendar-context";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const colorOptions = [
  {
    value: "bg-[#E6F6FD]",
    labelKey: "colorBlue" as const,
    calendarColor: "bg-blue-500",
  },
  {
    value: "bg-[#E7F8F2]",
    labelKey: "colorGreen" as const,
    calendarColor: "bg-green-500",
  },
  {
    value: "bg-[#FEF5E6]",
    labelKey: "colorAmber" as const,
    calendarColor: "bg-yellow-500",
  },
  {
    value: "bg-[#FFE4E6]",
    labelKey: "colorRed" as const,
    calendarColor: "bg-red-500",
  },
  {
    value: "bg-[#F3EEFE]",
    labelKey: "colorPurple" as const,
    calendarColor: "bg-purple-500",
  },
  {
    value: "bg-[#FCE7F3]",
    labelKey: "colorPink" as const,
    calendarColor: "bg-pink-500",
  },
  {
    value: "bg-[#E6FAF7]",
    labelKey: "colorTeal" as const,
    calendarColor: "bg-teal-500",
  },
];

const calendarColorToEventColor = Object.fromEntries(
  colorOptions.map((option) => [option.calendarColor, option.value]),
);

const colorMapping: Record<string, string> = {
  "bg-[#E6F6FD]": "#3B82F6",
  "bg-[#E7F8F2]": "#10B981",
  "bg-[#FEF5E6]": "#F59E0B",
  "bg-[#FFE4E6]": "#EF4444",
  "bg-[#F3EEFE]": "#8B5CF6",
  "bg-[#FCE7F3]": "#EC4899",
  "bg-[#E6FAF7]": "#14B8A6",
};

const hourOptions = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString().padStart(2, "0"),
  label: i.toString().padStart(2, "0"),
}));

const minuteOptions = Array.from({ length: 12 }, (_, i) => ({
  value: (i * 5).toString().padStart(2, "0"),
  label: (i * 5).toString().padStart(2, "0"),
}));

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventAdd: (event: CalendarEvent) => void;
  onEventUpdate: (event: CalendarEvent) => void;
  onEventDelete: (eventId: string) => void;
  initialDate: Date;
  initialEndDate?: Date | null;
  event: CalendarEvent | null;
  language: Language;
  timezone: string;
}

interface TimeInput {
  hours: string;
  minutes: string;
  rawInput: string;
  isCustomInput: boolean;
}

export default function EventDialog({
  open,
  onOpenChange,
  onEventAdd,
  onEventUpdate,
  onEventDelete,
  initialDate,
  initialEndDate,
  event,
  language,
  timezone,
}: EventDialogProps) {
  const { calendars } = useCalendar();
  const [title, setTitle] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);

  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);

  const [startTime, setStartTime] = useState<TimeInput>({
    hours: "00",
    minutes: "00",
    rawInput: "",
    isCustomInput: false,
  });
  const [endTime, setEndTime] = useState<TimeInput>({
    hours: "00",
    minutes: "30",
    rawInput: "",
    isCustomInput: false,
  });

  const [startTimeOpen, setStartTimeOpen] = useState(false);
  const [endTimeOpen, setEndTimeOpen] = useState(false);

  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const [location, setLocation] = useState("");
  const [participants, setParticipants] = useState("");
  const [notification, setNotification] = useState("0");
  const [customNotificationTime, setCustomNotificationTime] = useState("10");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(colorOptions[0].value);
  const [selectedCalendar, setSelectedCalendar] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [startTimeError, setStartTimeError] = useState(false);
  const [endTimeError, setEndTimeError] = useState(false);

  const t = translations[language];
  const isZh = isZhLanguage(language);
  const calendarSelectValue =
    selectedCalendar || (calendars.length > 0 ? "__uncategorized__" : "");
  const getEventColorByCalendarId = (calendarId: string) => {
    const calendar = calendars.find((item) => item.id === calendarId);
    if (!calendar) return colorOptions[0].value;
    return calendarColorToEventColor[calendar.color] ?? colorOptions[0].value;
  };

  const combineDateTime = (date: Date, timeInput: TimeInput): Date => {
    if (timeInput.isCustomInput && timeInput.rawInput) {
      const timeParts = timeInput.rawInput.split(":");
      if (timeParts.length === 2) {
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);

        if (
          !isNaN(hours) &&
          !isNaN(minutes) &&
          hours >= 0 &&
          hours < 24 &&
          minutes >= 0 &&
          minutes < 60
        ) {
          return set(new Date(date), {
            hours,
            minutes,
            seconds: 0,
            milliseconds: 0,
          });
        }
      }

      return set(new Date(date), {
        hours: parseInt(timeInput.hours, 10),
        minutes: parseInt(timeInput.minutes, 10),
        seconds: 0,
        milliseconds: 0,
      });
    }

    return set(new Date(date), {
      hours: parseInt(timeInput.hours, 10),
      minutes: parseInt(timeInput.minutes, 10),
      seconds: 0,
      milliseconds: 0,
    });
  };

  const getFullStartDate = () => combineDateTime(startDate, startTime);
  const getFullEndDate = () => combineDateTime(endDate, endTime);

  const validateTimeFormat = (input: string): boolean => {
    if (!input) return false;

    const timeParts = input.split(":");
    if (timeParts.length !== 2) return false;

    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);

    return (
      !isNaN(hours) &&
      !isNaN(minutes) &&
      hours >= 0 &&
      hours < 24 &&
      minutes >= 0 &&
      minutes < 60
    );
  };

  const handleStartTimeInput = (input: string) => {
    setStartTime((prev) => ({
      ...prev,
      rawInput: input,
      isCustomInput: true,
    }));

    if (input === "" || validateTimeFormat(input)) {
      setStartTimeError(false);
    } else {
      setStartTimeError(true);
    }
  };

  const handleEndTimeInput = (input: string) => {
    setEndTime((prev) => ({
      ...prev,
      rawInput: input,
      isCustomInput: true,
    }));

    if (input === "" || validateTimeFormat(input)) {
      setEndTimeError(false);
    } else {
      setEndTimeError(true);
    }
  };

  const extractTimeFromDate = (date: Date): TimeInput => {
    return {
      hours: getHours(date).toString().padStart(2, "0"),
      minutes: getMinutes(date).toString().padStart(2, "0"),
      rawInput: format(date, "HH:mm"),
      isCustomInput: false,
    };
  };

  useEffect(() => {
    if (open) {
      if (event) {
        setTitle(event.title);
        setIsAllDay(event.isAllDay);

        const startDateObj = new Date(event.startDate);
        const endDateObj = new Date(event.endDate);

        setStartDate(startDateObj);
        setEndDate(endDateObj);
        setStartTime(extractTimeFromDate(startDateObj));
        setEndTime(extractTimeFromDate(endDateObj));

        setLocation(event.location || "");
        setParticipants(event.participants.join(", "));
        if (event.notification !== undefined) {
          if (
            event.notification > 0 &&
            event.notification !== 5 &&
            event.notification !== 15 &&
            event.notification !== 30 &&
            event.notification !== 60
          ) {
            setNotification("custom");
            setCustomNotificationTime(event.notification.toString());
          } else {
            setNotification(event.notification.toString());
          }
        } else {
          setNotification("0");
        }
        setDescription(event.description || "");
        setColor(event.color);
        setSelectedCalendar(event.calendarId || "");
      } else {
        resetForm();
        if (initialDate) {
          const dialogStartDate = new Date(initialDate);
          const dialogEndDate =
            initialEndDate && initialEndDate > initialDate
              ? new Date(initialEndDate)
              : new Date(initialDate.getTime() + 30 * 60000);

          setStartDate(dialogStartDate);
          if (calendars.length > 0) {
            setColor(getEventColorByCalendarId(calendars[0].id));
          }
          setEndDate(dialogEndDate);

          const initialHour = getHours(dialogStartDate);
          const initialMinute = getMinutes(dialogStartDate);

          setStartTime({
            hours: initialHour.toString().padStart(2, "0"),
            minutes: initialMinute.toString().padStart(2, "0"),
            rawInput: format(dialogStartDate, "HH:mm"),
            isCustomInput: false,
          });

          setEndTime({
            hours: getHours(dialogEndDate).toString().padStart(2, "0"),
            minutes: getMinutes(dialogEndDate).toString().padStart(2, "0"),
            rawInput: format(dialogEndDate, "HH:mm"),
            isCustomInput: false,
          });
        }
      }
    }
  }, [event, calendars, initialDate, initialEndDate, open]);

  const resetForm = () => {
    const now = new Date();
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60000);

    setTitle("");
    setIsAllDay(false);
    setStartDate(now);
    setEndDate(now);
    setStartTime(extractTimeFromDate(now));
    setEndTime(extractTimeFromDate(thirtyMinutesLater));
    setLocation("");
    setParticipants("");
    setNotification("0");
    setCustomNotificationTime("10");
    setDescription("");
    setColor(colorOptions[0].value);
    setSelectedCalendar("");
    setStartTimeError(false);
    setEndTimeError(false);
  };

  const handleStartDateChange = (newDate: Date | undefined) => {
    if (!newDate) return;

    setStartDate(newDate);

    const fullNewStartDate = combineDateTime(newDate, startTime);
    const fullCurrentEndDate = getFullEndDate();

    if (fullCurrentEndDate < fullNewStartDate) {
      const newEndDate = new Date(fullNewStartDate);
      newEndDate.setMinutes(newEndDate.getMinutes() + 30);

      setEndDate(newDate);
      setEndTime(extractTimeFromDate(newEndDate));
    }
  };

  const handleStartTimeChange = (hours: string, minutes: string) => {
    setStartTime({
      hours,
      minutes,
      rawInput: `${hours}:${minutes}`,
      isCustomInput: false,
    });

    const newStartDate = set(new Date(startDate), {
      hours: parseInt(hours),
      minutes: parseInt(minutes),
      seconds: 0,
      milliseconds: 0,
    });

    const currentEndDate = getFullEndDate();

    if (currentEndDate <= newStartDate) {
      const newEndDate = new Date(newStartDate);
      newEndDate.setMinutes(newStartDate.getMinutes() + 30);

      setEndTime(extractTimeFromDate(newEndDate));

      if (
        endDate.getDate() !== startDate.getDate() ||
        endDate.getMonth() !== startDate.getMonth() ||
        endDate.getFullYear() !== startDate.getFullYear()
      ) {
        setEndDate(startDate);
      }
    }
  };

  const validateForm = (): boolean => {
    if (startTime.isCustomInput && !validateTimeFormat(startTime.rawInput)) {
      setStartTimeError(true);
      return false;
    }

    if (endTime.isCustomInput && !validateTimeFormat(endTime.rawInput)) {
      setEndTimeError(true);
      return false;
    }

    const fullStartDate = getFullStartDate();
    const fullEndDate = getFullEndDate();

    if (fullEndDate < fullStartDate) {
      setEndTimeError(true);
      alert(t.endTimeError);
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    let notificationMinutes = Number.parseInt(notification);
    if (notification === "custom") {
      notificationMinutes = Number.parseInt(customNotificationTime);
    }

    const fullStartDate = getFullStartDate();
    const fullEndDate = getFullEndDate();

    const eventData: CalendarEvent = {
      id:
        event?.id ||
        Date.now().toString() + Math.random().toString(36).substring(2, 9),
      title: title.trim() || t.untitledInParentheses,
      isAllDay,
      startDate: fullStartDate,
      endDate: fullEndDate,
      recurrence: "none",
      location,
      participants: participants
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      notification: notificationMinutes,
      description,
      color,
      calendarId:
        selectedCalendar === "__uncategorized__" ? "" : selectedCalendar,
    };

    if (event) {
      onEventUpdate(eventData);
    } else {
      onEventAdd(eventData);
    }
    onOpenChange(false);
  };

  const handleAiSubmit = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);

    try {
      const response = await fetch("/api/chat/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          currentValues: {
            title,
            startDate: format(getFullStartDate(), "yyyy-MM-dd'T'HH:mm"),
            endDate: format(getFullEndDate(), "yyyy-MM-dd'T'HH:mm"),
            location,
            participants,
            description,
          },
        }),
      });

      if (!response.ok) throw new Error("AI请求失败");

      const result = await response.json();
      if (result.data) {
        const {
          title: newTitle,
          startDate: newStart,
          endDate: newEnd,
          location: newLocation,
          participants: newParticipants,
          description: newDescription,
        } = result.data;

        if (newTitle) setTitle(newTitle);

        if (newStart) {
          const startDateObj = new Date(newStart);
          setStartDate(startDateObj);
          setStartTime(extractTimeFromDate(startDateObj));
        }

        if (newEnd) {
          const endDateObj = new Date(newEnd);
          setEndDate(endDateObj);
          setEndTime(extractTimeFromDate(endDateObj));
        }

        if (newLocation) setLocation(newLocation);
        if (newParticipants) setParticipants(newParticipants);
        if (newDescription) setDescription(newDescription);
      }
    } catch (error) {
      console.error("AI错误:", error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const renderTimeSelector = (
    value: TimeInput,
    onChange: (hours: string, minutes: string) => void,
    onCustomInput: (input: string) => void,
    isOpen: boolean,
    setOpen: (open: boolean) => void,
    hasError: boolean,
  ) => {
    const displayTime = value.isCustomInput
      ? value.rawInput
      : `${value.hours}:${value.minutes}`;

    return (
      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-auto justify-start text-left font-normal",
              hasError && "border-red-500 text-red-500",
              !displayTime && "text-muted-foreground",
            )}
          >
            <Clock className="mr-2 h-4 w-4" />
            {displayTime || (isZh ? "选择时间" : "Select time")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 space-y-3">
            <div className="flex items-center space-x-2">
              <Select
                value={value.hours}
                onValueChange={(newHour) => onChange(newHour, value.minutes)}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder={isZh ? "时" : "Hour"} />
                </SelectTrigger>
                <SelectContent>
                  {hourOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-center">:</span>

              <Select
                value={value.minutes}
                onValueChange={(newMinute) => onChange(value.hours, newMinute)}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder={isZh ? "分" : "Min"} />
                </SelectTrigger>
                <SelectContent>
                  {minuteOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-1">
              <Label htmlFor="custom-time">
                {isZh ? "自定义时间 (HH:mm)" : "Custom time (HH:mm)"}
              </Label>
              <Input
                id="custom-time"
                value={value.isCustomInput ? value.rawInput : ""}
                onChange={(e) => onCustomInput(e.target.value)}
                placeholder="14:30"
                className={cn(hasError && "border-red-500")}
              />
              {hasError && (
                <p className="text-xs text-red-500">
                  {isZh
                    ? "请使用正确的格式 (HH:mm)"
                    : "Please use the correct format (HH:mm)"}
                </p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>{event ? t.update : t.createEvent}</DialogTitle>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pb-6">
          <div>
            <Label htmlFor="title">{t.title}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="all-day"
              checked={isAllDay}
              onCheckedChange={(checked) => {
                const isChecked = checked as boolean;
                setIsAllDay(isChecked);

                if (isChecked) {
                  const startOfDay = new Date(startDate);
                  startOfDay.setHours(0, 0, 0, 0);

                  const endOfDay = new Date(startDate);
                  endOfDay.setHours(23, 59, 59, 999);

                  setStartTime({
                    hours: "00",
                    minutes: "00",
                    rawInput: "00:00",
                    isCustomInput: false,
                  });

                  setEndTime({
                    hours: "23",
                    minutes: "59",
                    rawInput: "23:59",
                    isCustomInput: false,
                  });
                }
              }}
            />
            <Label htmlFor="all-day">{t.allDay}</Label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.startTime}</Label>
              <div className="flex flex-col space-y-2">
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, "yyyy-MM-dd")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        if (date) {
                          handleStartDateChange(date);
                          setStartDateOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {!isAllDay &&
                  renderTimeSelector(
                    startTime,
                    handleStartTimeChange,
                    handleStartTimeInput,
                    startTimeOpen,
                    setStartTimeOpen,
                    startTimeError,
                  )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t.endTime}</Label>
              <div className="flex flex-col space-y-2">
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(endDate, "yyyy-MM-dd")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        if (date) {
                          setEndDate(date);
                          setEndDateOpen(false);

                          const fullStartDate = getFullStartDate();
                          const possibleEndDate = combineDateTime(
                            date,
                            endTime,
                          );

                          if (possibleEndDate < fullStartDate) {
                            setEndTimeError(true);
                          } else {
                            setEndTimeError(false);
                          }
                        }
                      }}
                      initialFocus
                      disabled={(date) => date < startDate}
                    />
                  </PopoverContent>
                </Popover>

                {!isAllDay &&
                  renderTimeSelector(
                    endTime,
                    (hours, minutes) => {
                      setEndTime({
                        hours,
                        minutes,
                        rawInput: `${hours}:${minutes}`,
                        isCustomInput: false,
                      });

                      const fullStartDate = getFullStartDate();
                      const possibleEndDate = set(new Date(endDate), {
                        hours: parseInt(hours),
                        minutes: parseInt(minutes),
                        seconds: 0,
                      });

                      setEndTimeError(possibleEndDate < fullStartDate);
                    },
                    handleEndTimeInput,
                    endTimeOpen,
                    setEndTimeOpen,
                    endTimeError,
                  )}
              </div>
              {endTimeError && !isAllDay && (
                <p className="text-xs text-red-500">{t.endTimeError}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="calendar">{t.calendar}</Label>
            <Select
              value={calendarSelectValue}
              onValueChange={(value) => {
                setSelectedCalendar(value);
                if (value !== "__uncategorized__") {
                  setColor(getEventColorByCalendarId(value));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t.selectCalendar} />
              </SelectTrigger>
              <SelectContent>
                {calendars.length > 0 && (
                  <SelectItem value="__uncategorized__">
                    <div className="flex items-center">
                      <div className="w-4 h-4 rounded-full mr-2 border border-muted-foreground/50" />
                      {t.uncategorized}
                    </div>
                  </SelectItem>
                )}
                {calendars.map((calendar) => (
                  <SelectItem key={calendar.id} value={calendar.id}>
                    <div className="flex items-center">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full mr-2",
                          calendar.color,
                        )}
                      />
                      {calendar.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="color">{t.color}</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger>
                <SelectValue placeholder={t.selectColor} />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center">
                      <div
                        className={cn("w-4 h-4 rounded-full mr-2")}
                        style={{ backgroundColor: colorMapping[option.value] }}
                      />
                      {t[option.labelKey]}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="location">{t.location}</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="participants">{t.participants}</Label>
            <Input
              id="participants"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder={t.participantsPlaceholder}
            />
          </div>

          <div>
            <Label htmlFor="notification">{t.notification}</Label>
            <Select value={notification} onValueChange={setNotification}>
              <SelectTrigger>
                <SelectValue placeholder={t.selectNotification} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t.atEventTime}</SelectItem>
                <SelectItem value="5">
                  {t.minutesBefore.replace("{minutes}", "5")}
                </SelectItem>
                <SelectItem value="15">
                  {t.minutesBefore.replace("{minutes}", "15")}
                </SelectItem>
                <SelectItem value="30">
                  {t.minutesBefore.replace("{minutes}", "30")}
                </SelectItem>
                <SelectItem value="60">
                  {t.hourBefore.replace("{hours}", "1")}
                </SelectItem>
                <SelectItem value="custom">{t.customTime}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {notification === "custom" && (
            <div>
              <Label htmlFor="custom-notification-time">
                {t.customTimeMinutes}
              </Label>
              <Input
                id="custom-notification-time"
                type="number"
                min="1"
                value={customNotificationTime}
                onChange={(e) => setCustomNotificationTime(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <Label htmlFor="description">{t.description}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t.cancel}
            </Button>
            <Button type="submit">{event ? t.update : t.save}</Button>
            {event && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onEventDelete(event.id);
                  onOpenChange(false);
                }}
              >
                {t.delete}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
