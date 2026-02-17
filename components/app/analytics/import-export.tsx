"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  Upload,
  CalendarIcon,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  decryptPayload,
  encryptPayload,
  isEncryptedPayload,
} from "@/lib/crypto";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { translations, useLanguage } from "@/lib/i18n";
import { Checkbox } from "@/components/ui/checkbox";
import type { CalendarEvent } from "../calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface ImportExportProps {
  events: CalendarEvent[];
  onImportEvents: (events: CalendarEvent[]) => void;
}

export default function ImportExport({
  events,
  onImportEvents,
}: ImportExportProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("ics");
  const [importTab, setImportTab] = useState("file");
  const [importUrl, setImportUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [dateRangeOption, setDateRangeOption] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [jsonPassword, setJsonPassword] = useState("");
  const [jsonPasswordConfirm, setJsonPasswordConfirm] = useState("");
  const [jsonImportEncrypted, setJsonImportEncrypted] = useState(false);
  const [jsonImportPassword, setJsonImportPassword] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [language] = useLanguage();
  const t = translations[language];

  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    const handleLanguageChange = () => {
      setForceUpdate((prev) => prev + 1);
    };

    window.addEventListener("languagechange", handleLanguageChange);
    return () => {
      window.removeEventListener("languagechange", handleLanguageChange);
    };
  }, []);

  const handleExport = async () => {
    try {
      setIsLoading(true);

      let filteredEvents = [...events];

      if (dateRangeOption === "future") {
        const now = new Date();
        filteredEvents = filteredEvents.filter(
          (event) => new Date(event.startDate) >= now,
        );
      } else if (dateRangeOption === "past") {
        const now = new Date();
        filteredEvents = filteredEvents.filter(
          (event) => new Date(event.startDate) < now,
        );
      } else if (dateRangeOption === "30days") {
        const now = new Date();
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        filteredEvents = filteredEvents.filter(
          (event) =>
            new Date(event.startDate) >= thirtyDaysAgo &&
            new Date(event.startDate) <= now,
        );
      } else if (dateRangeOption === "90days") {
        const now = new Date();
        const ninetyDaysAgo = new Date(
          now.getTime() - 90 * 24 * 60 * 60 * 1000,
        );
        filteredEvents = filteredEvents.filter(
          (event) =>
            new Date(event.startDate) >= ninetyDaysAgo &&
            new Date(event.startDate) <= now,
        );
      }

      if (exportFormat === "ics") {
        const icsContent = generateICSFile(filteredEvents);
        downloadFile(icsContent, "calendar-export.ics", "text/calendar");
      } else if (exportFormat === "json") {
        let jsonContent = JSON.stringify(filteredEvents, null, 2);

        const hasAnyPasswordInput =
          jsonPassword.trim() || jsonPasswordConfirm.trim();
        if (hasAnyPasswordInput) {
          if (!jsonPassword.trim()) {
            throw new Error(t.passwordRequired || "Password is required");
          }

          if (jsonPassword !== jsonPasswordConfirm) {
            throw new Error(t.passwordsDoNotMatch || "Passwords do not match");
          }

          const encrypted = await encryptPayload(jsonPassword, jsonContent);
          jsonContent = JSON.stringify(
            { ...encrypted, encrypted: true, format: "one-calendar-json-v1" },
            null,
            2,
          );
        }

        downloadFile(jsonContent, "calendar-export.json", "application/json");
      } else if (exportFormat === "csv") {
        const csvContent = generateCSV(filteredEvents);
        downloadFile(csvContent, "calendar-export.csv", "text/csv");
      }

      toast(
        t.exportSuccess.replace("{count}", filteredEvents.length.toString()),
        {
          description: `${filteredEvents.length} ${t.events || "events"}`,
        },
      );

      setExportDialogOpen(false);
    } catch (error) {
      toast(t.exportError, {
        description: t.exportError,
        variant: "destructive",
      });
      console.error("Export error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setIsLoading(true);
      setDebugInfo("");
      let importedEvents: CalendarEvent[] = [];
      let rawContent = "";

      if (importTab === "file" && selectedFile) {
        const fileExt = selectedFile.name.split(".").pop()?.toLowerCase();
        rawContent = await selectedFile.text();

        if (fileExt === "ics") {
          importedEvents = parseICS(rawContent);
        } else if (fileExt === "json") {
          importedEvents = await parseJsonEvents(rawContent);
        } else if (fileExt === "csv") {
          importedEvents = parseCSV(rawContent);
        } else {
          throw new Error(t.unsupportedFormat || "Unsupported file format");
        }
      } else if (importTab === "url" && importUrl) {
        const response = await fetch(importUrl);
        rawContent = await response.text();

        if (importUrl.endsWith(".ics")) {
          importedEvents = parseICS(rawContent);
        } else if (importUrl.endsWith(".json")) {
          importedEvents = await parseJsonEvents(rawContent);
        } else {
          throw new Error(t.unsupportedUrlFormat || "Unsupported URL format");
        }
      }

      if (debugMode) {
        setDebugInfo(`${t.parsedEvents || "Parsed"} ${importedEvents.length} ${t.events || "events"}

${t.rawContentPreview || "Raw content preview"}:
${rawContent.substring(0, 500)}...`);
      }

      if (importedEvents.length === 0) {
        toast(t.importWarning, {
          description: t.importWarning,
          variant: "destructive",
        });
        return;
      }

      onImportEvents(importedEvents);

      toast(
        t.importSuccess.replace("{count}", importedEvents.length.toString()),
        {
          description: `${importedEvents.length} ${t.events || "events"}`,
        },
      );

      if (!debugMode) {
        setImportDialogOpen(false);
      }
      if (debugMode && importedEvents.length > 0) {
        const firstEvent = importedEvents[0];
        setDebugInfo(`${t.parsedEvents || "Parsed"} ${importedEvents.length} ${t.events || "events"}

First event details:
Title: ${firstEvent.title}
Start: ${new Date(firstEvent.startDate).toLocaleString()} (Local)
End: ${new Date(firstEvent.endDate).toLocaleString()} (Local)
UTC Start: ${new Date(firstEvent.startDate).toUTCString()}
UTC End: ${new Date(firstEvent.endDate).toUTCString()}

${t.rawContentPreview || "Raw content preview"}:
${rawContent.substring(0, 500)}...`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t.unknownError || "Unknown error";
      toast(t.importError.replace("{error}", errorMessage), {
        description: errorMessage,
        variant: "destructive",
      });
      console.error("Import error:", error);

      if (debugMode) {
        setDebugInfo(`${t.importError}: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const parseJsonEvents = async (
    rawContent: string,
  ): Promise<CalendarEvent[]> => {
    const parsed = JSON.parse(rawContent);

    if (isEncryptedPayload(parsed) || parsed?.encrypted) {
      if (!jsonImportEncrypted) {
        throw new Error(
          t.encryptedJsonNeedToggle ||
            "This JSON file is encrypted. Please enable encrypted import.",
        );
      }

      if (!jsonImportPassword.trim()) {
        throw new Error(t.passwordRequired || "Password is required");
      }

      if (!isEncryptedPayload(parsed)) {
        throw new Error(
          t.invalidEncryptedJson || "Invalid encrypted JSON payload",
        );
      }

      const decrypted = await decryptPayload(
        jsonImportPassword,
        parsed.ciphertext,
        parsed.iv,
      );
      const decryptedEvents = JSON.parse(decrypted);

      if (!Array.isArray(decryptedEvents)) {
        throw new Error(
          t.invalidEncryptedJson || "Invalid encrypted JSON payload",
        );
      }

      return decryptedEvents as CalendarEvent[];
    }

    if (Array.isArray(parsed)) {
      return parsed as CalendarEvent[];
    }

    throw new Error(t.unsupportedFormat || "Unsupported file format");
  };

  const generateICSFile = (events: CalendarEvent[]): string => {
    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//One Calendar//NONSGML v1.0//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

    const formatDate = (date: Date) => {
      const utcYear = date.getUTCFullYear();
      const utcMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
      const utcDay = String(date.getUTCDate()).padStart(2, "0");
      const utcHours = String(date.getUTCHours()).padStart(2, "0");
      const utcMinutes = String(date.getUTCMinutes()).padStart(2, "0");
      const utcSeconds = String(date.getUTCSeconds()).padStart(2, "0");

      return `${utcYear}${utcMonth}${utcDay}T${utcHours}${utcMinutes}${utcSeconds}Z`;
    };

    events.forEach((event) => {
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);

      icsContent += `BEGIN:VEVENT
UID:${event.id}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.title}
${event.description ? `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}` : ""}
${event.location ? `LOCATION:${event.location}` : ""}
END:VEVENT
`;
    });

    icsContent += "END:VCALENDAR";
    return icsContent;
  };

  const generateCSV = (events: CalendarEvent[]): string => {
    const headers = [
      "Title",
      "Start Date",
      "End Date",
      "Location",
      "Description",
      "Color",
    ];

    const rows = events.map((event) => [
      event.title,
      new Date(event.startDate).toISOString(),
      new Date(event.endDate).toISOString(),
      event.location || "",
      event.description || "",
      event.color,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    return csvContent;
  };

  const parseICS = (icsContent: string): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const lines = icsContent.split(/\r\n|\n|\r/);

    let currentEvent: Partial<CalendarEvent> = {};
    let inEvent = false;
    const continuationLine = "";

    const processedLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith(" ") || line.startsWith("\t")) {
        if (processedLines.length > 0) {
          processedLines[processedLines.length - 1] += line.substring(1);
        }
      } else {
        processedLines.push(line);
      }
    }

    for (const line of processedLines) {
      if (line.startsWith("BEGIN:VEVENT")) {
        currentEvent = {
          id:
            Date.now().toString() + Math.random().toString(36).substring(2, 9),
          title: t.unnamedEvent || "Unnamed Event",
          isAllDay: false,
          recurrence: "none",
          participants: [],
          notification: 0,
          color: "bg-blue-500",
          calendarId: "1",
        };
        inEvent = true;
      } else if (line.startsWith("END:VEVENT")) {
        if (inEvent && currentEvent.title && currentEvent.startDate) {
          if (
            !currentEvent.endDate ||
            new Date(currentEvent.endDate) < new Date(currentEvent.startDate)
          ) {
            currentEvent.endDate = new Date(
              new Date(currentEvent.startDate).getTime() + 60 * 60 * 1000,
            );
          }

          events.push(currentEvent as CalendarEvent);
        }
        currentEvent = {};
        inEvent = false;
      } else if (inEvent) {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex);
          const value = line.substring(colonIndex + 1);

          const [mainKey, ...params] = key.split(";");

          switch (mainKey) {
            case "SUMMARY":
              currentEvent.title = value;
              break;
            case "DESCRIPTION":
              currentEvent.description = value
                .replace(/\\n/g, "\n")
                .replace(/\\,/g, ",");
              break;
            case "LOCATION":
              currentEvent.location = value;
              break;
            case "UID":
              currentEvent.id = value;
              break;
            case "DTSTART":
              try {
                const hasTimeZone = params.some((p) => p.startsWith("TZID="));
                const isAllDay = !value.includes("T");

                currentEvent.startDate = parseICSDate(value, hasTimeZone);
                currentEvent.isAllDay = isAllDay;
              } catch (e) {
                console.error("Error parsing DTSTART:", value, e);
              }
              break;
            case "DTEND":
              try {
                const hasTimeZone = params.some((p) => p.startsWith("TZID="));
                currentEvent.endDate = parseICSDate(value, hasTimeZone);
              } catch (e) {
                console.error("Error parsing DTEND:", value, e);
              }
              break;
            case "RRULE":
              if (value.includes("FREQ=DAILY")) {
                currentEvent.recurrence = "daily";
              } else if (value.includes("FREQ=WEEKLY")) {
                currentEvent.recurrence = "weekly";
              } else if (value.includes("FREQ=MONTHLY")) {
                currentEvent.recurrence = "monthly";
              } else if (value.includes("FREQ=YEARLY")) {
                currentEvent.recurrence = "yearly";
              }
              break;
          }
        }
      }
    }

    return events;
  };

  const parseICSDate = (dateString: string, hasTimeZone: boolean): Date => {
    let year,
      month,
      day,
      hour = 0,
      minute = 0,
      second = 0;

    const hasOffset =
      dateString.includes("+") ||
      (dateString.includes("-") && dateString.indexOf("-") > 8);
    const isUTC = dateString.endsWith("Z");

    if (dateString.includes("T")) {
      let datePart, timePart;

      if (hasOffset) {
        const offsetIndex = Math.max(
          dateString.lastIndexOf("+"),
          dateString.lastIndexOf("-"),
        );
        datePart = dateString.substring(0, dateString.indexOf("T"));
        timePart = dateString.substring(
          dateString.indexOf("T") + 1,
          offsetIndex,
        );

        const offsetPart = dateString.substring(offsetIndex);
        const isoDateString = `${datePart.substring(0, 4)}-${datePart.substring(4, 6)}-${datePart.substring(6, 8)}T${timePart.substring(0, 2)}:${timePart.substring(2, 4)}:${timePart.substring(4, 6)}${offsetPart.substring(0, 3)}:${offsetPart.substring(3, 5)}`;
        const parsedDate = new Date(isoDateString);

        if (!Number.isNaN(parsedDate.getTime())) {
          return parsedDate;
        }

        year = Number.parseInt(datePart.substring(0, 4), 10);
        month = Number.parseInt(datePart.substring(4, 6), 10) - 1;
        day = Number.parseInt(datePart.substring(6, 8), 10);
        hour = Number.parseInt(timePart.substring(0, 2), 10);
        minute = Number.parseInt(timePart.substring(2, 4), 10);
        second = Number.parseInt(timePart.substring(4, 6), 10);

        const offsetSign = offsetPart.charAt(0) === "+" ? 1 : -1;
        const offsetHours = Number.parseInt(offsetPart.substring(1, 3), 10);
        const offsetMinutes = Number.parseInt(offsetPart.substring(3, 5), 10);
        const totalOffsetMinutes =
          offsetSign * (offsetHours * 60 + offsetMinutes);
        const utcTime =
          Date.UTC(year, month, day, hour, minute, second) -
          totalOffsetMinutes * 60 * 1000;

        return new Date(utcTime);
      } else if (isUTC) {
        datePart = dateString.split("T")[0];
        timePart = dateString.split("T")[1].replace("Z", "");

        year = Number.parseInt(datePart.substring(0, 4), 10);
        month = Number.parseInt(datePart.substring(4, 6), 10) - 1;
        day = Number.parseInt(datePart.substring(6, 8), 10);

        if (timePart.length >= 6) {
          hour = Number.parseInt(timePart.substring(0, 2), 10);
          minute = Number.parseInt(timePart.substring(2, 4), 10);
          second = Number.parseInt(timePart.substring(4, 6), 10);
        }

        return new Date(Date.UTC(year, month, day, hour, minute, second));
      } else {
        datePart = dateString.split("T")[0];
        timePart = dateString.split("T")[1];

        year = Number.parseInt(datePart.substring(0, 4), 10);
        month = Number.parseInt(datePart.substring(4, 6), 10) - 1;
        day = Number.parseInt(datePart.substring(6, 8), 10);

        if (timePart.length >= 6) {
          hour = Number.parseInt(timePart.substring(0, 2), 10);
          minute = Number.parseInt(timePart.substring(2, 4), 10);
          second = Number.parseInt(timePart.substring(4, 6), 10);
        }

        return new Date(year, month, day, hour, minute, second);
      }
    } else {
      year = Number.parseInt(dateString.substring(0, 4), 10);
      month = Number.parseInt(dateString.substring(4, 6), 10) - 1;
      day = Number.parseInt(dateString.substring(6, 8), 10);

      return new Date(year, month, day);
    }
  };

  const parseCSV = (csvContent: string): CalendarEvent[] => {
    const lines = csvContent.split("\n");
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);

    const events: CalendarEvent[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = parseCSVLine(lines[i]);

      if (values.length >= 2) {
        const titleIndex = headers.findIndex((h) =>
          h.toLowerCase().includes("title"),
        );
        const startDateIndex = headers.findIndex((h) =>
          h.toLowerCase().includes("start"),
        );
        const endDateIndex = headers.findIndex((h) =>
          h.toLowerCase().includes("end"),
        );
        const locationIndex = headers.findIndex((h) =>
          h.toLowerCase().includes("location"),
        );
        const descriptionIndex = headers.findIndex((h) =>
          h.toLowerCase().includes("description"),
        );
        const colorIndex = headers.findIndex((h) =>
          h.toLowerCase().includes("color"),
        );

        const title =
          titleIndex >= 0 && titleIndex < values.length
            ? values[titleIndex]
            : t.unnamedEvent || "Unnamed Event";
        const startDate =
          startDateIndex >= 0 && startDateIndex < values.length
            ? new Date(values[startDateIndex])
            : new Date();
        let endDate =
          endDateIndex >= 0 && endDateIndex < values.length
            ? new Date(values[endDateIndex])
            : new Date(startDate.getTime() + 60 * 60 * 1000);

        if (endDate < startDate) {
          endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        }

        events.push({
          id:
            Date.now().toString() + Math.random().toString(36).substring(2, 9),
          title,
          startDate,
          endDate,
          isAllDay: false,
          recurrence: "none",
          location:
            locationIndex >= 0 && locationIndex < values.length
              ? values[locationIndex]
              : undefined,
          participants: [],
          notification: 0,
          description:
            descriptionIndex >= 0 && descriptionIndex < values.length
              ? values[descriptionIndex]
              : undefined,
          color:
            colorIndex >= 0 && colorIndex < values.length
              ? values[colorIndex]
              : "bg-blue-500",
          calendarId: "1",
        });
      }
    }

    return events;
  };

  const parseCSVLine = (line: string): string[] => {
    const result = [];
    let insideQuotes = false;
    let currentValue = "";

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (i < line.length - 1 && line[i + 1] === '"') {
          currentValue += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        result.push(currentValue.trim());
        currentValue = "";
      } else {
        currentValue += char;
      }
    }

    result.push(currentValue.trim());
    return result;
  };

  const downloadFile = (
    content: string,
    filename: string,
    mimeType: string,
  ) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{t.importExport}</CardTitle>
            <CardDescription>
              {t.importExportDesc ||
                "Exchange data with other calendar applications"}
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {t.importCalendar}
            </Button>
            <Button onClick={() => setExportDialogOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              {t.exportCalendar}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.googleCalendarGuide}</AlertTitle>
            <AlertDescription>{t.googleCalendarGuideText}</AlertDescription>
          </Alert>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">{t.importExportTips}</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>{t.tip1}</li>
              <li>{t.tip2}</li>
              <li>{t.tip3}</li>
              <li>{t.tip4}</li>
              <li>{t.tip5}</li>
            </ul>
          </div>
        </div>
      </CardContent>

      {}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.importCalendar}</DialogTitle>
          </DialogHeader>

          <Tabs
            defaultValue="file"
            value={importTab}
            onValueChange={setImportTab}
          >
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="file">{t.fileImport}</TabsTrigger>
              <TabsTrigger value="url">{t.urlImport}</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="calendar-file">{t.selectCalendarFile}</Label>
                <Input
                  id="calendar-file"
                  type="file"
                  accept=".ics,.json,.csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">
                  {t.supportedFormats}
                </p>
              </div>

              <Alert variant="outline">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t.googleCalendarGuideText}</AlertDescription>
              </Alert>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="debug-mode"
                  checked={debugMode}
                  onCheckedChange={(checked) =>
                    setDebugMode(checked as boolean)
                  }
                />
                <Label htmlFor="debug-mode">{t.debugMode}</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="json-import-encrypted"
                  checked={jsonImportEncrypted}
                  onCheckedChange={(checked) =>
                    setJsonImportEncrypted(checked as boolean)
                  }
                />
                <Label htmlFor="json-import-encrypted">
                  {t.thisJsonEncrypted ||
                    "This JSON file is password-encrypted"}
                </Label>
              </div>

              {jsonImportEncrypted && (
                <div className="space-y-2">
                  <Label htmlFor="json-import-password">
                    {t.password || "Password"}
                  </Label>
                  <Input
                    id="json-import-password"
                    type="password"
                    value={jsonImportPassword}
                    onChange={(e) => setJsonImportPassword(e.target.value)}
                    placeholder={t.enterPassword || "Enter a password"}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="url" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="calendar-url">{t.calendarUrl}</Label>
                <Input
                  id="calendar-url"
                  type="url"
                  placeholder="https://example.com/calendar.ics"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t.enterUrl}</p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="debug-mode-url"
                  checked={debugMode}
                  onCheckedChange={(checked) =>
                    setDebugMode(checked as boolean)
                  }
                />
                <Label htmlFor="debug-mode-url">{t.debugMode}</Label>
              </div>
            </TabsContent>
          </Tabs>

          {debugInfo && (
            <div className="mt-4 rounded-md bg-muted p-2">
              <h4 className="font-medium mb-1">{t.debugInfo}</h4>
              <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                {debugInfo}
              </pre>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button onClick={handleImport} disabled={isLoading}>
              {isLoading ? t.importing : t.import}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.exportCalendar}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="export-format">{t.exportFormat}</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger id="export-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ics">iCalendar (.ics)</SelectItem>
                  <SelectItem value="json">JSON (.json)</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-range">{t.dateRange}</Label>
              <Select
                value={dateRangeOption}
                onValueChange={setDateRangeOption}
              >
                <SelectTrigger id="date-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allEvents}</SelectItem>
                  <SelectItem value="future">{t.futureEvents}</SelectItem>
                  <SelectItem value="past">{t.pastEvents}</SelectItem>
                  <SelectItem value="30days">{t.last30Days}</SelectItem>
                  <SelectItem value="90days">{t.last90Days}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {exportFormat === "json" && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-2">
                  <Label htmlFor="json-password">
                    {t.passwordOptionalForEncryption}
                  </Label>
                  <Input
                    id="json-password"
                    type="password"
                    value={jsonPassword}
                    onChange={(e) => setJsonPassword(e.target.value)}
                    placeholder={t.enterPassword || "Enter a password"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="json-password-confirm">
                    {t.confirmYourPassword || "Confirm your password"}
                  </Label>
                  <Input
                    id="json-password-confirm"
                    type="password"
                    value={jsonPasswordConfirm}
                    onChange={(e) => setJsonPasswordConfirm(e.target.value)}
                    placeholder={
                      t.confirmYourPassword || "Confirm your password"
                    }
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-completed"
                checked={includeCompleted}
                onCheckedChange={(checked) =>
                  setIncludeCompleted(checked as boolean)
                }
              />
              <Label htmlFor="include-completed">{t.includeCompleted}</Label>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button onClick={handleExport} disabled={isLoading}>
              {isLoading ? t.exporting : t.export}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
